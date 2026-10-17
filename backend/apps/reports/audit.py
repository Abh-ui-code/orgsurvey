"""
The audit trail of one survey as an Excel workbook: what it asked, who it went
through, every step it took, and every time it was sent back with which
comments on which questions.

Sheets: Summary, Questions, Audit trail, Returns, Answers by round.
"""
from io import BytesIO

from django.utils import timezone
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

from apps.core.question_types import is_empty
from apps.surveys.models import Survey, SurveyQuestion

ACTION_LABELS = {
    "created": "Created",
    "published": "Published and assigned",
    "submitted": "Response submitted",
    "reviewed": "Passed review",
    "approved": "Approved",
    "returned": "Returned",
    "closed": "Closed",
}
AUDIENCE_LABELS = {"responder": "Responder", "reviewer": "Reviewer", "both": "Responder and reviewer"}
HEADER_FILL = PatternFill("solid", fgColor="1F6F78")
HEADER_FONT = Font(bold=True, color="FFFFFF")
WRAP = Alignment(wrap_text=True, vertical="top")


def _when(value):
    if value is None:
        return ""
    return timezone.localtime(value).strftime("%Y-%m-%d %H:%M")


def _name(person):
    return (person.full_name or person.email) if person else ""


def _text(value):
    """An answer as a spreadsheet cell: lists joined, empties as a dash."""
    if is_empty(value):
        return "—"
    if isinstance(value, list):
        return ", ".join(str(v) for v in value)
    return value if isinstance(value, (int, float)) else str(value)


def _sheet(wb, title, header, rows, widths, first=False):
    ws = wb.active if first else wb.create_sheet()
    ws.title = title
    ws.append(header)
    for cell in ws[1]:
        cell.fill, cell.font, cell.alignment = HEADER_FILL, HEADER_FONT, WRAP
    for row in rows:
        ws.append(row)
    for i, width in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = width
    for row in ws.iter_rows(min_row=2):
        for cell in row:
            cell.alignment = WRAP
    ws.freeze_panes = "A2"
    return ws


def build_workbook(survey: Survey) -> bytes:
    events = list(survey.events.select_related("by").prefetch_related("question_comments__author"))
    questions = list(
        SurveyQuestion.objects.filter(section__survey=survey).select_related("section").order_by("section__order", "order")
    )
    numbered = {q.pk: (n, q) for n, q in enumerate(questions, start=1)}
    role_of = {}
    for role in ("responder", "reviewer", "approver"):
        person = getattr(survey, role)
        if person:
            role_of[person.pk] = role.capitalize()
    submissions = [e for e in events if e.action == "submitted"]
    returns = [e for e in events if e.action == "returned"]

    wb = Workbook()

    # ---- Summary
    published = next((e for e in events if e.action == "published"), None)
    finished = next((e for e in reversed(events) if e.action in ("approved", "closed")), None)
    summary = [
        ("Survey", survey.title),
        ("Category", survey.category.label),
        ("Aimed at (org block)", survey.target_unit.name),
        ("Description", survey.description),
        ("Instructions", survey.instructions),
        ("Status", dict(Survey.STATUSES).get(survey.status, survey.status)),
        ("Responder", _name(survey.responder)),
        ("Reviewer", _name(survey.reviewer)),
        ("Approver", _name(survey.approver)),
        ("Due date", survey.due_date.isoformat() if survey.due_date else ""),
        ("Created by", _name(survey.created_by)),
        ("Created", _when(survey.created_at)),
        ("Published", _when(survey.published_at)),
        ("Finished", _when(finished.created_at) if finished else ""),
        ("Days from publish to finish", (finished.created_at - published.created_at).days if finished and published else ""),
        ("Number of questions", len(questions)),
        ("Times submitted", len(submissions)),
        ("Times returned", len(returns)),
        ("Returned to responder", sum(1 for e in returns if e.audience in ("responder", "both"))),
        ("Returned to reviewer", sum(1 for e in returns if e.audience in ("reviewer", "both"))),
        ("Question comments in total", sum(len(e.question_comments.all()) for e in returns)),
        ("Report generated", _when(timezone.now())),
    ]
    ws = _sheet(wb, "Summary", ["Item", "Value"], summary, [32, 70], first=True)
    for row in ws.iter_rows(min_row=2, max_col=1):
        row[0].font = Font(bold=True)

    # ---- Questions (what the survey consists of, with the latest answer)
    _sheet(
        wb, "Questions",
        ["#", "Section", "Question", "Type", "Options", "Required", "Hint", "Latest submitted answer"],
        [
            [n, q.section.title, q.text, q.type, ", ".join(q.options), "Yes" if q.required else "No", q.hint, _text(survey.answers.get(str(q.id)))]
            for n, q in enumerate(questions, start=1)
        ],
        [5, 22, 60, 14, 30, 10, 30, 40],
    )

    # ---- Audit trail (every step)
    trail = []
    for step, e in enumerate(events, start=1):
        trail.append([
            step, _when(e.created_at), ACTION_LABELS.get(e.action, e.action), _name(e.by),
            role_of.get(e.by_id, "Administrator" if e.by_id else ""),
            AUDIENCE_LABELS.get(e.audience, "") if e.action == "returned" else "",
            e.comment, len(e.question_comments.all()) or "",
        ])
    _sheet(wb, "Audit trail", ["Step", "Date and time", "Action", "By", "Role", "Returned to", "Comment", "Question comments"], trail, [6, 18, 24, 24, 14, 24, 60, 18])

    # ---- Returns (each return, each question comment)
    rows = []
    for count, e in enumerate(returns, start=1):
        base = [count, _when(e.created_at), _name(e.by), role_of.get(e.by_id, ""), AUDIENCE_LABELS.get(e.audience, ""), e.comment]
        notes = list(e.question_comments.all())
        if not notes:
            rows.append([*base, "", "", "", ""])
        for c in notes:
            n, q = numbered.get(c.question_id, ("", None))
            rows.append([*base, q.section.title if q else "", n, q.text if q else "(question removed)", c.text])
    _sheet(
        wb, "Returns",
        ["Return #", "Date and time", "Returned by", "Role", "Returned to", "General comment", "Section", "Q#", "Question", "Comment on question"],
        rows, [9, 18, 24, 12, 24, 40, 22, 5, 50, 50],
    )

    # ---- Answers by round (what was submitted each time)
    header = ["#", "Section", "Question"] + [f"Submission {i} ({_when(e.created_at)})" for i, e in enumerate(submissions, start=1)]
    rows = [
        [n, q.section.title, q.text, *[_text(e.snapshot.get(str(q.id))) for e in submissions]]
        for n, q in enumerate(questions, start=1)
    ]
    _sheet(wb, "Answers by round", header, rows, [5, 22, 50] + [30] * len(submissions))

    out = BytesIO()
    wb.save(out)
    return out.getvalue()
