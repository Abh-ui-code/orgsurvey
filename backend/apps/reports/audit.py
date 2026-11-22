"""
The audit trail of one survey as an Excel workbook: what it asked, who it went
through, every step it took, and every time it was sent back with which
comments on which questions.

A second sheet, "Table answers", draws each table question's latest answer as a real table, one spreadsheet
column per table column (including the columns the respondent added).

The first sheet, "Audit report", has three stacked blocks on a shared grid of eight
columns: survey details, a timeline of every step, and one row per question
with the answer from each submission and the comments made on it.
"""
from io import BytesIO

from django.utils import timezone
from openpyxl import Workbook
from openpyxl.cell.rich_text import CellRichText, TextBlock
from openpyxl.cell.text import InlineFont
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

from apps.core.question_types import answer_text, split_answer, split_columns
from apps.surveys.models import Survey, SurveyQuestion

STATUS_LABELS = dict(SurveyQuestion.STATUSES)
ACTION_LABELS = {
    "created": "Created",
    "published": "Published and assigned",
    "submitted": "Response submitted",
    "reviewed": "Passed review",
    "approved": "Approved",
    "returned": "Returned",
    "closed": "Closed",
}
AUDIENCE_LABELS = {"responder": "Respondent", "reviewer": "Reviewer", "both": "Respondent and reviewer"}
HEADER_FILL = PatternFill("solid", fgColor="1F6F78")
HEADER_FONT = Font(bold=True, color="FFFFFF")
BAND_FILL = PatternFill("solid", fgColor="E3F0F1")
BAND_FONT = Font(bold=True, color="164F56")
LABEL_FILL = PatternFill("solid", fgColor="F5F7F7")
CHANGED_FILL = PatternFill("solid", fgColor="FFF4CF")
RETURNED_FONT = Font(bold=True, color="B4492D")
OK_FONT = Font(bold=True, color="2C7A4B")
EDGE = Side(style="thin", color="D9DFE0")
BOX = Border(left=EDGE, right=EDGE, top=EDGE, bottom=EDGE)
ZEBRA_FILL = PatternFill("solid", fgColor="F8FAFA")
WIDTHS = [8, 20, 46, 30, 24, 24, 24, 60]
WRAP = Alignment(wrap_text=True, vertical="top")


def _when(value):
    if value is None:
        return ""
    return timezone.localtime(value).strftime("%Y-%m-%d %H:%M:%S")


def _nice(value):
    """A readable moment: 17 Oct 2026, 13:19:05."""
    if value is None:
        return ""
    return timezone.localtime(value).strftime("%d %b %Y, %H:%M:%S").lstrip("0")


TYPE_LABELS = {
    "text": "Free text", "single_choice": "Single choice", "multi_choice": "Multiple choice",
    "rating": "Rating (1-5)", "yes_no": "Yes / No", "number": "Number", "date": "Date",
}


def _name(person):
    return (person.full_name or person.email) if person else ""


def _numbered(question):
    """The question as the PDF numbers it: "[305-1 a] What were ...?" for a standard's question, as is otherwise."""
    bank = question.bank_question if question.bank_question_id and question.section.gri_standard_id else None
    if bank is None or not bank.gri_ref:
        return question.text
    item = bank.gri_item
    number = bank.gri_ref + (item if item.startswith(".") else f" {item}" if item else "")
    return f"[{number}] {question.text}"


def _cell(question, value):
    """An answer as a spreadsheet cell: a plain number stays a number, everything else is text."""
    if isinstance(value, (int, float)) and not isinstance(value, bool) and not getattr(question, "unit", ""):
        return value
    return answer_text(question, value)


SHEET = "Audit report"


class _Sheet:
    """Writes the stacked blocks, tracking the next free row."""

    def __init__(self):
        self.wb = Workbook()
        self.ws = self.wb.active
        self.ws.title = SHEET
        self.row = 1
        for i, width in enumerate(WIDTHS, start=1):
            self.ws.column_dimensions[get_column_letter(i)].width = width

    def band(self, title):
        ws = self.ws
        ws.merge_cells(start_row=self.row, start_column=1, end_row=self.row, end_column=8)
        cell = ws.cell(self.row, 1, title.upper())
        cell.fill, cell.font = BAND_FILL, BAND_FONT
        self.row += 1

    def header(self, labels):
        for col, label in enumerate(labels, start=1):
            cell = self.ws.cell(self.row, col, label)
            cell.fill, cell.font, cell.alignment = HEADER_FILL, HEADER_FONT, WRAP
        self.row += 1

    def line(self, values):
        for col, value in enumerate(values, start=1):
            self.ws.cell(self.row, col).value = value
            self.ws.cell(self.row, col).alignment = WRAP
        self.row += 1
        return self.row - 1

    def pair(self, left, right):
        """A label/value pair on each half: labels in A:B and D:E, values in C and F:H."""
        ws, r = self.ws, self.row
        ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=2)
        ws.merge_cells(start_row=r, start_column=4, end_row=r, end_column=5)
        ws.merge_cells(start_row=r, start_column=6, end_row=r, end_column=8)
        for col, value in ((1, left[0]), (3, left[1]), (4, right[0] if right else ""), (6, right[1] if right else "")):
            ws.cell(r, col, value).alignment = WRAP
        for col in (1, 4):
            ws.cell(r, col).fill, ws.cell(r, col).font = LABEL_FILL, Font(bold=True)
        self.row += 1

    def gap(self):
        self.row += 1


def _files_line(names):
    return f"Files: {', '.join(names)}" if names else ""


def _comment_files(comment):
    """The files a reviewer or approver sent with a comment, as a line of names."""
    return _files_line([a.name for a in comment.attachments.all()])


def _submission_extras(event, question):
    """What went with a submitted answer besides the answer: the respondent's note and files."""
    detail = (event.details or {}).get(str(question.id)) or {}
    lines = []
    if detail.get("note"):
        lines.append(f"Note: {detail['note']}")
    files = _files_line([f["name"] for f in detail.get("files", [])])
    if files:
        lines.append(files)
    return "\n".join(lines)


def _role(role_of, pk, action, default="Administrator"):
    """What a person was acting as in one step. Someone who is both a respondent and the reviewer is a
    respondent when they submit and the reviewer when they review."""
    roles = role_of.get(pk)
    if not roles:
        return default
    if action == "submitted" and "Respondent" in roles:
        return "Respondent"
    return next((r for r in ("Reviewer", "Approver") if r in roles), roles[0])


def _comment_parts(comment, event, role_of):
    """One comment as rich text: a bold line (when, who, to whom), then the words."""
    to = AUDIENCE_LABELS.get(event.audience, "")
    who = f"{_name(comment.author)} ({_role(role_of, comment.author.pk, event.action)})" if comment.author else "Unknown"
    files = _comment_files(comment)
    return [TextBlock(InlineFont(b=True), f"{_nice(event.created_at)} · {who}{' → ' + to if to else ''}\n"), comment.text + (f"\n{files}" if files else "")]


def _numbers(numbers):
    """Question numbers as ranges: [1, 2, 3, 7] -> "Q1-Q3, Q7"."""
    runs, start, last = [], None, None
    for n in sorted(numbers):
        if start is None:
            start = last = n
        elif n == last + 1:
            last = n
        else:
            runs.append((start, last))
            start = last = n
    if start is not None:
        runs.append((start, last))
    return ", ".join(f"Q{a}" if a == b else f"Q{a}-Q{b}" for a, b in runs)


def _span(ws, row, start):
    """Stretch the cell at `start` across to column H, keeping the box border on every part."""
    if start < 8:
        ws.merge_cells(start_row=row, start_column=start, end_row=row, end_column=8)
    for col in range(start, 9):
        ws.cell(row, col).border = BOX


def _polish(ws):
    """Readability pass: no gridlines, light cell borders, zebra stripes, centred
    short columns, taller bands and headers, and a landscape page that fits one width."""
    ws.sheet_view.showGridLines = False
    ws.sheet_view.zoomScale = 100
    stripe = False
    for row in ws.iter_rows(min_row=1, max_row=ws.max_row, max_col=ws.max_column):
        first = row[0]
        if first.value is None and all(c.value is None for c in row):
            stripe = False
            continue
        is_band = first.fill == BAND_FILL
        is_header = first.fill == HEADER_FILL
        if is_band:
            ws.row_dimensions[first.row].height = 24
            for c in row:
                c.alignment = Alignment(vertical="center", indent=1)
            continue
        if is_header:
            ws.row_dimensions[first.row].height = 32
            stripe = False
        else:
            stripe = not stripe
        for c in row:
            if c.fill == PatternFill():  # untouched cell
                if stripe and not is_header:
                    c.fill = ZEBRA_FILL
            if c.value is not None or c.fill != PatternFill():
                c.border = BOX
            if c.column == 1 and isinstance(c.value, int) and not is_header:
                c.alignment = Alignment(horizontal="center", vertical="top")
            if is_header:
                c.alignment = Alignment(wrap_text=True, vertical="center")
    ws.page_setup.orientation = "landscape"
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True


TABLE_SHEET = "Table answers"
TABLE_WIDTHS = [48, 38, 28, 28, 28, 28, 28]
ADDED_FILL = PatternFill("solid", fgColor="EEF6F0")


def _table_cell(part, value):
    """One cell of a table answer: a figure stays a number, a date its ISO text, anything else text."""
    if value in ("", None):
        return ""
    if part.get("kind") == "number" and isinstance(value, (int, float)) and not isinstance(value, bool):
        return value
    return str(value)


def _table_lines(q, value):
    """A table answer as (headings, lines): the question's two headings then one per column the respondent
    added, and one line per row as (label, values, added_by_respondent). Used by both sheets so they agree."""
    answer, extra = split_answer(value)
    columns, cells = split_columns(value)
    answer = answer if isinstance(answer, list) else []
    heads = [q.row_header or "Item", q.value_header or "Answer", *[c or f"Column {j + 1}" for j, c in enumerate(columns)]]
    lines = []
    for i, part in enumerate(q.parts):
        label = f"{part['label']} ({part['unit']})" if part.get("unit") else part["label"]
        vals = [_table_cell(part, answer[i] if i < len(answer) else "")]
        vals += [(cells[i][j] if i < len(cells) and j < len(cells[i]) else "") for j in range(len(columns))]
        lines.append((label, vals, False))
    for r in extra:
        lines.append((r.get("label", ""), [r.get("value", "")] + [(r.get("cols") or [""] * len(columns))[j] for j in range(len(columns))], True))
    return heads, lines


def _inline_table(ws, sheet, q, versions):
    """Under a table question's row, its latest answer as a real table: the question's own columns in C and D,
    then one column for each column the respondent added. Cells that changed since the previous answer are
    highlighted and rows the respondent added are shaded green."""
    heads, lines = _table_lines(q, versions[-1].snapshot[str(q.id)])
    before = {}
    if len(versions) > 1:
        for label, vals, _ in _table_lines(q, versions[-2].snapshot[str(q.id)])[1]:
            before[label] = vals
    for j in range(len(heads)):  # columns beyond the usual grid still get a sensible width
        col = get_column_letter(3 + j)
        if ws.column_dimensions[col].width is None or ws.column_dimensions[col].width < 20:
            ws.column_dimensions[col].width = 24
    width = lambda c: ws.column_dimensions[get_column_letter(c)].width or 13
    r = sheet.row
    for j, text in enumerate(heads):
        cell = ws.cell(r, 3 + j, text)
        cell.fill, cell.font, cell.alignment = BAND_FILL, BAND_FONT, Alignment(wrap_text=True, vertical="center", indent=1 if j == 0 else 0)
        cell.border = BOX
    ws.row_dimensions[r].height = 22
    r += 1
    for k, (label, vals, added) in enumerate(lines):
        for j, v in enumerate([label, *vals]):
            cell = ws.cell(r, 3 + j, v)
            cell.alignment = Alignment(wrap_text=True, vertical="top", horizontal="left", indent=1 if j == 0 else 0)
            cell.border = BOX
            if j == 0:
                cell.font = Font(bold=True)
            if added:
                cell.fill = ADDED_FILL
            elif k % 2:
                cell.fill = ZEBRA_FILL
            if j and label in before and (before[label][j - 1] if j - 1 < len(before[label]) else "") != v:
                cell.fill = CHANGED_FILL
        tallest = max(
            sum(-(-max(len(part), 1) // int(width(3 + j) * 0.95)) for part in str(v).split("\n"))
            for j, v in enumerate([label, *vals])
        )
        ws.row_dimensions[r].height = max(18, 15 * tallest + 3)
        r += 1
    sheet.row = r


TABLE_BELOW = "Table answer, drawn below"
TABLE_ABOVE = "Table answer as submitted above"


def _changed_cells(q, before, after) -> int:
    """How many cells of a table answer differ from the previous submission of it."""
    old = {label: vals for label, vals, _ in _table_lines(q, before.snapshot[str(q.id)])[1]}
    count = 0
    for label, vals, _ in _table_lines(q, after.snapshot[str(q.id)])[1]:
        prev = old.get(label, [""] * len(vals))
        count += sum(1 for j, v in enumerate(vals) if (prev[j] if j < len(prev) else "") != v)
    return count


def _table_sheet(wb, questions, recorded):
    """A second sheet with every table question's latest submitted answer drawn as a real table: the question's
    own columns, then one spreadsheet column for each column the respondent added, so it reads like the form did.
    Rows the respondent added are shaded."""
    tables = []
    for q in questions:
        if q.type != "table":
            continue
        found = [e for _, e in recorded if q.pk in {x.pk for x in e.questions.all()} and e.snapshot.get(str(q.id)) is not None]
        if found:
            tables.append((q, len(found), found[-1]))
    if not tables:
        return
    ws = wb.create_sheet(TABLE_SHEET)
    ws.sheet_view.showGridLines = False
    for i, width in enumerate(TABLE_WIDTHS, start=1):
        ws.column_dimensions[get_column_letter(i)].width = width
    ncols = 2 + max(len(split_columns(e.snapshot[str(q.id)])[0]) for q, _, e in tables)
    row = 1

    def merged(r, text, fill=None, font=None, height=None):
        ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=ncols)
        cell = ws.cell(r, 1, text)
        cell.alignment = Alignment(wrap_text=True, vertical="center", indent=1)
        if fill:
            for c in range(1, ncols + 1):
                ws.cell(r, c).fill = fill
        if font:
            cell.font = font
        if height:
            ws.row_dimensions[r].height = height

    merged(row, "TABLE ANSWERS · each table question as a table, latest submitted answer (rows added by the respondent are shaded green)", BAND_FILL, BAND_FONT, 24)
    row += 2
    number_of = {q.pk: n for n, q in enumerate(questions, start=1)}
    for q, n, e in tables:
        value = e.snapshot[str(q.id)]
        heads, lines = _table_lines(q, value)
        title = f"Q{number_of[q.pk]} · {_numbered(q)}"
        info = f"Respondent: {_name(q.responder) or 'Unassigned'}  ·  Status: {STATUS_LABELS.get(q.status, q.status)}  ·  Answer {n} ({'first submission' if n == 1 else 'resubmitted'}), {_nice(e.created_at)}"
        chars = int(sum(TABLE_WIDTHS[:ncols]) * 0.95)  # characters that fit on one line across the table
        merged(row, title, BAND_FILL, BAND_FONT, max(24, 15 * -(-len(title) // chars) + 9))
        row += 1
        merged(row, info, LABEL_FILL, None, max(18, 15 * -(-len(info) // chars) + 3))
        row += 1
        for c, text in enumerate(heads, start=1):
            cell = ws.cell(row, c, text)
            cell.fill, cell.font, cell.alignment, cell.border = HEADER_FILL, HEADER_FONT, Alignment(wrap_text=True, vertical="center"), BOX
        ws.row_dimensions[row].height = 28
        row += 1
        for k, (label, vals, added) in enumerate(lines):
            for c, v in enumerate([label, *vals], start=1):
                cell = ws.cell(row, c, v)
                cell.alignment = Alignment(wrap_text=True, vertical="top", horizontal="left")
                cell.border = BOX
                if c == 1:
                    cell.font = Font(bold=True)
                if added:
                    cell.fill = ADDED_FILL
                elif k % 2:
                    cell.fill = ZEBRA_FILL
            # Size the row for its tallest cell: wrapped length plus any line breaks the respondent typed.
            tallest = max(
                sum(-(-max(len(part), 1) // int(TABLE_WIDTHS[c] * 0.95)) for part in str(v).split("\n"))
                for c, v in enumerate([label, *vals]) if c < len(TABLE_WIDTHS)
            )
            ws.row_dimensions[row].height = max(18, 15 * tallest + 3)
            row += 1
        row += 1
    ws.freeze_panes = "A3"
    ws.page_setup.orientation = "landscape"
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True


def build_workbook(survey: Survey) -> bytes:
    events = list(survey.events.select_related("by").prefetch_related("question_comments__author", "question_comments__attachments"))
    questions = list(
        SurveyQuestion.objects.filter(section__survey=survey).select_related("section", "responder", "bank_question").order_by("section__order", "order")
    )
    role_of = {}
    for q in questions:
        if q.responder:
            role_of.setdefault(q.responder.pk, ["Respondent"])
    for role in ("reviewer", "approver"):
        person = getattr(survey, role)
        if person:
            role_of.setdefault(person.pk, []).append(role.capitalize())
    number_of = {q.pk: n for n, q in enumerate(questions, start=1)}
    respondents = list(dict.fromkeys(_name(q.responder) for q in questions if q.responder))
    submissions = [e for e in events if e.action == "submitted"]
    returns = [e for e in events if e.action == "returned"]
    published = next((e for e in events if e.action == "published"), None)
    finished = next((e for e in reversed(events) if e.action in ("approved", "closed")), None)

    sheet = _Sheet()
    ws = sheet.ws

    # ---- 1. Survey details
    sheet.band("1 · Survey details")
    days = (finished.created_at - published.created_at).days if finished and published else ""
    left = [
        ("Survey", survey.title), ("Category", survey.category.label), ("Aimed at (org block)", survey.target_unit.name),
        ("Status", dict(Survey.STATUSES).get(survey.status, survey.status)), ("Due date", survey.due_date.isoformat() if survey.due_date else ""),
        ("Number of questions", len(questions)), ("Questions approved", sum(1 for q in questions if q.status == "approved")),
        ("Times submitted", len(submissions)),
        ("Question comments in total", sum(len(e.question_comments.all()) for e in events)), ("Created by", _name(survey.created_by)),
    ]
    right = [
        ("Respondents", ", ".join(respondents)), ("Reviewer", _name(survey.reviewer)), ("Approver", _name(survey.approver)),
        ("Published", _when(survey.published_at)), ("Finished", _when(finished.created_at) if finished else ""),
        ("Days from publish to finish", days), ("Times returned", len(returns)),
        ("Returned to respondent / reviewer", f"{sum(1 for e in returns if e.audience in ('responder', 'both'))} / {sum(1 for e in returns if e.audience in ('reviewer', 'both'))}"),
        ("Report generated", _when(timezone.now())),
    ]
    for l, r in zip(left, right):
        sheet.pair(l, r)
    for label, value in (("Description", survey.description), ("Instructions", survey.instructions)):
        if value:
            sheet.pair((label, value), None)
    sheet.gap()

    # ---- 2. Timeline
    sheet.band("2 · Timeline, every step in order")
    sheet.header(["Step", "Date and time", "Action", "By", "Role", "Returned to", "Questions", "Comment"])
    for step, e in enumerate(events, start=1):
        r = sheet.line([
            step, _nice(e.created_at), ACTION_LABELS.get(e.action, e.action), _name(e.by),
            _role(role_of, e.by_id, e.action, "Administrator" if e.by_id else ""),
            AUDIENCE_LABELS.get(e.audience, "") if e.action == "returned" else "",
            _numbers(number_of[q.pk] for q in e.questions.all() if q.pk in number_of), e.comment,
        ])
        if e.action in ("returned", "closed"):
            ws.cell(r, 3).font = RETURNED_FONT
        elif e.action == "approved":
            ws.cell(r, 3).font = OK_FONT
    sheet.gap()

    # ---- 3. Questions: answer per submission, comments per question
    sheet.band("3 · Questions, answers by submission, and comments")
    # Only submissions whose answers were recorded get a column. Earlier ones (from
    # before answer history existed) stay in the timeline. The first three fill E:G;
    # any more continue to the right of the Comments column.
    recorded = [(n, e) for n, e in enumerate(submissions, start=1) if e.snapshot]
    # One answer column per time a question was answered (first answer, then each resubmission), not per
    # submission, so a survey whose respondents each submit once has a single answer column.
    revisions = {
        q.pk: [e for _, e in recorded if q.pk in {x.pk for x in e.questions.all()} and str(q.id) in e.snapshot]
        for q in questions
    }
    answer_cols = max((len(v) for v in revisions.values()), default=0)
    sub_col = lambda i: 5 + i if i < 3 else 8 + (i - 2)
    # Comments start in the first column no answer uses and stretch to H, so
    # a survey answered once has no empty columns in between.
    first_comment = 5 + min(answer_cols, 3)
    sheet.header(["Q#", "Section", "Question", "Respondent and status"])
    header_row = sheet.row - 1
    cell = ws.cell(header_row, first_comment, "Comments on this question")
    cell.fill, cell.font, cell.alignment = HEADER_FILL, HEADER_FONT, WRAP
    span = lambda r: _span(ws, r, first_comment)
    span(header_row)
    for i in range(answer_cols):
        col = sub_col(i)
        cell = ws.cell(header_row, col, f"Answer {i + 1}\n({'first submission' if i == 0 else 'resubmitted'})")
        cell.fill, cell.font, cell.alignment = HEADER_FILL, HEADER_FONT, WRAP
        ws.column_dimensions[get_column_letter(col)].width = 24
    if len(recorded) < len(submissions):
        skipped = len(submissions) - len(recorded)
        ws.merge_cells(start_row=sheet.row, start_column=3, end_row=sheet.row, end_column=8)
        sheet.line(["", "", f"{skipped} earlier submission{'s' if skipped != 1 else ''} made before answers were recorded: see the timeline above."])
        ws.cell(sheet.row - 1, 3).font = Font(italic=True, color="5B6B6E")

    if any(q.type == "table" for q in questions):
        ws.merge_cells(start_row=sheet.row, start_column=3, end_row=sheet.row, end_column=8)
        sheet.line(["", "", f"Table questions are written out line by line here and drawn as proper tables, one column per table column, on the \"{TABLE_SHEET}\" sheet."])
        ws.cell(sheet.row - 1, 3).font = Font(italic=True, color="5B6B6E")

    notes_by_question = {}
    for e in events:
        for c in e.question_comments.all():
            notes_by_question.setdefault(c.question_id, []).append(_comment_parts(c, e, role_of))
    for n, q in enumerate(questions, start=1):
        shown = _numbered(q)
        r = sheet.line([n, q.section.title, shown, f"{_name(q.responder) or 'Unassigned'}\n{STATUS_LABELS.get(q.status, q.status)}"])
        notes = notes_by_question.get(q.pk)
        target = ws.cell(r, first_comment)
        target.alignment = WRAP
        if notes:
            parts = []
            for k, note in enumerate(notes):
                parts += (["\n\n"] if k else []) + note
            target.value = CellRichText(*parts)
        else:
            target.value = "No comments"
            target.font = Font(color="5B6B6E")
        span(r)
        # Merged cells don't auto-fit their height, so size the row for its longest cell.
        width = sum(WIDTHS[first_comment - 1:])
        lines = sum(-(-len(t) // width) + 1 for t in (note[-1] for note in notes)) if notes else 1
        ws.row_dimensions[r].height = max(15 * max(lines + len(notes or []) - 1, -(-len(shown) // WIDTHS[2])), 18)
        previous = None
        for i, e in enumerate(revisions[q.pk]):
            value = _cell(q, e.snapshot.get(str(q.id)))
            extras = _submission_extras(e, q)
            cell = ws.cell(r, sub_col(i), f"{value}\n\n{extras}" if extras else value)
            cell.alignment = Alignment(wrap_text=True, vertical="top", horizontal="left")
            if q.type == "table":
                latest = i == len(revisions[q.pk]) - 1
                note = "Table: see the rows below" if latest else "Earlier answer, replaced by the resubmitted table below (changed cells are highlighted)"
                cell.value = f"{note}\n\n{extras}" if extras else note
                cell.font = Font(italic=True, color="5B6B6E")
                continue
            if previous is not None and value != previous:
                cell.fill = CHANGED_FILL
            previous = value
        if q.type == "table" and revisions[q.pk]:
            _inline_table(ws, sheet, q, revisions[q.pk])

    # ---- 4. Each question's own trail
    sheet.gap()
    sheet.band("4 · Question trail, every step of every question")
    sheet.header(["Q#", "Date and time", "Step", "By", "Question", "Answer at this step", "Changed from", "Comment"])
    covered = {e.pk: {q.pk for q in e.questions.all()} for e in events}
    for n, q in enumerate(questions, start=1):
        last_answer = None
        revisions = 0
        tables = []  # a table question's submissions so far, each drawn as a real table under its step
        for e in events:
            if q.pk not in covered[e.pk]:
                continue
            if e.action == "submitted":
                revisions += 1
                answer = _cell(q, e.snapshot.get(str(q.id)))
                drawn = q.type == "table" and e.snapshot.get(str(q.id)) is not None
                if drawn:
                    tables.append(e)
                    answer = TABLE_BELOW
                changed_from = last_answer if last_answer is not None and last_answer != answer else ""
                if drawn and len(tables) > 1:
                    changed = _changed_cells(q, tables[-2], tables[-1])
                    changed_from = f"{changed} cell{'s' if changed != 1 else ''} changed (highlighted below)" if changed else "No change"
                step = "Answer submitted" if revisions == 1 else f"Answer resubmitted (revision {revisions})"
                last_answer = answer
            else:
                answer = last_answer if last_answer is not None else ""
                if q.type == "table" and tables:
                    answer = TABLE_ABOVE
                changed_from = ""
                step = ACTION_LABELS.get(e.action, e.action)
                if e.action == "returned" and e.audience:
                    step = f"Returned to {AUDIENCE_LABELS[e.audience].lower()}"
            notes = [
                "\n".join(part for part in (c.text, _comment_files(c)) if part)
                for c in e.question_comments.all()
                if c.question_id == q.pk
            ]
            if e.action == "submitted":
                extras = _submission_extras(e, q)
                notes = ([extras] if extras else []) + notes
            comment = "\n".join(([e.comment] if e.comment else []) + notes)
            who = f"{_name(e.by)} ({_role(role_of, e.by_id, e.action)})" if e.by_id else ""
            r = sheet.line([n, _nice(e.created_at), step, who, q.text, answer, changed_from, comment])
            if e.action == "returned":
                ws.cell(r, 3).font = RETURNED_FONT
            elif e.action == "approved":
                ws.cell(r, 3).font = OK_FONT
            if answer in (TABLE_BELOW, TABLE_ABOVE):
                ws.cell(r, 6).font = Font(italic=True, color="5B6B6E")
            elif changed_from:
                ws.cell(r, 6).fill = CHANGED_FILL
            if answer == TABLE_BELOW:
                if changed_from:
                    ws.cell(r, 7).font = Font(italic=True, color="5B6B6E")
                _inline_table(ws, sheet, q, tables)

    _polish(ws)
    _table_sheet(sheet.wb, questions, recorded)
    out = BytesIO()
    sheet.wb.save(out)
    return out.getvalue()
