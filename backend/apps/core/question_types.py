"""
One definition of what a question is and what counts as a valid answer,
shared by the question bank and by surveys, so the two can never disagree.
"""
import datetime

from apps.core.exceptions import ApiError

TYPES = ["text", "single_choice", "multi_choice", "rating", "yes_no", "number", "date", "table", "short_text"]
PART_KINDS = ("number", "text", "date")
UNIT_MAX, LABEL_MAX, EXTRA_ROWS_MAX, SHORT_TEXT_MAX = 40, 200, 30, 200
CHOICE_TYPES = {"single_choice", "multi_choice"}


def clean_question_fields(data) -> dict:
    """Validate and normalise the fields a question is made of."""
    text = str(data.get("text", "")).strip()
    if not text:
        raise ApiError("Question text is required.")
    qtype = data.get("type", "text")
    if qtype not in TYPES:
        raise ApiError("Unknown question type.")
    options = []
    if qtype in CHOICE_TYPES:
        options = [str(o).strip() for o in data.get("options", []) if str(o).strip()]
        if len(options) < 2:
            raise ApiError("Choice questions need at least two options.")
        if len(set(options)) != len(options):
            raise ApiError("Options must be different from each other.")
    unit = str(data.get("unit", "") or "").strip()[:UNIT_MAX] if qtype in ("number", "short_text") else ""
    parts = []
    if qtype == "table":
        for part in data.get("parts") or []:
            label = str(part.get("label", "")).strip()
            kind = part.get("kind", "text")
            if not label:
                raise ApiError("Every row of a table question needs a label.")
            if kind not in PART_KINDS:
                raise ApiError("A table row is a number, text or a date.")
            parts.append({"label": label[:LABEL_MAX], "kind": kind, "unit": str(part.get("unit", "") or "").strip()[:UNIT_MAX] if kind == "number" else ""})
        if not parts:
            raise ApiError("A table question needs at least one row.")
    return {
        "text": text,
        "type": qtype,
        "unit": unit,
        "parts": parts,
        "options": options,
        "hint": str(data.get("hint", "")).strip(),
        "required": bool(data.get("required", True)),
    }


def _is_number(v) -> bool:
    return not isinstance(v, bool) and isinstance(v, (int, float)) and v == v and abs(v) != float("inf")


def is_empty(value) -> bool:
    if isinstance(value, dict):  # an answer with extra rows: empty when its own answer is
        return is_empty(value.get("answer"))
    if isinstance(value, list):  # a table answer is a list with a slot per row, so blank slots count as empty
        return all(v is None or v == "" for v in value)
    return value is None or value == ""


def split_answer(value):
    """(answer, extra rows) of a stored value: a bare answer, or {"answer": ..., "extra": [...]}."""
    if isinstance(value, dict):
        return value.get("answer"), value.get("extra") or []
    return value, []


def _clean_extra(label: str, rows) -> list:
    """The rows a respondent added beyond the question: [{label, value}], blank rows dropped."""
    if not isinstance(rows, list) or len(rows) > EXTRA_ROWS_MAX:
        raise ApiError(f"Add at most {EXTRA_ROWS_MAX} extra rows to: {label}")
    out = []
    for r in rows:
        if not isinstance(r, dict) or not isinstance(r.get("label", ""), str) or not isinstance(r.get("value", ""), str):
            raise ApiError(f"That isn't a valid extra row for: {label}")
        row = {"label": r.get("label", "").strip(), "value": r.get("value", "").strip()}
        if len(row["label"]) > LABEL_MAX or len(row["value"]) > 5000:
            raise ApiError(f"An extra row is too long for: {label}")
        if row["label"] or row["value"]:
            out.append(row)
    return out


def clean_answer(question: dict, value):
    """validate_answer, then the value in the form it is stored: strings trimmed, blank extra rows dropped,
    and None when there is nothing to store."""
    validate_answer(question, value)
    answer, extra = split_answer(value)
    if isinstance(answer, str):
        answer = answer.strip()
    extra = _clean_extra(f'"{question["text"]}"', extra) if extra else []
    if is_empty(answer):
        answer = None
    if answer is None and not extra:
        return None
    return {"answer": answer, "extra": extra} if extra else answer


def validate_answer(question: dict, value) -> None:
    """Raise ApiError unless `value` is an acceptable answer to `question`
    (a dict with text/type/options/required)."""
    label = f'"{question["text"]}"'
    if isinstance(value, dict) and set(value) - {"answer", "extra"}:
        raise ApiError(f"That isn't a valid answer for: {label}")
    extra = split_answer(value)[1]
    if extra:
        _clean_extra(label, extra)
    value = split_answer(value)[0]
    if is_empty(value):
        if question["required"]:
            raise ApiError(f"Please answer: {label}")
        return
    qtype = question["type"]
    bad = ApiError(f"That isn't a valid answer for: {label}")
    if qtype == "text":
        if not isinstance(value, str) or len(value) > 5000:
            raise bad
    elif qtype == "short_text":
        if not isinstance(value, str) or len(value) > SHORT_TEXT_MAX:
            raise ApiError(f"Keep the answer to {SHORT_TEXT_MAX} characters for: {label}")
    elif qtype == "rating":
        if isinstance(value, bool) or not isinstance(value, int) or not 1 <= value <= 5:
            raise ApiError(f"Choose a rating from 1 to 5 for: {label}")
    elif qtype == "yes_no":
        if value not in ("Yes", "No"):
            raise bad
    elif qtype == "single_choice":
        if value not in question["options"]:
            raise bad
    elif qtype == "multi_choice":
        if not isinstance(value, list) or len(set(value)) != len(value) or any(v not in question["options"] for v in value):
            raise bad
    elif qtype == "number":
        if not _is_number(value):
            raise ApiError(f"Enter a number for: {label}")
    elif qtype == "table":
        parts = question.get("parts") or []
        if not isinstance(value, list) or len(value) != len(parts):
            raise bad
        for part, v in zip(parts, value):
            if part["kind"] == "number":
                if v not in ("", None) and not _is_number(v):
                    raise ApiError(f"Enter a number for \"{part['label']}\" in: {label}")
            elif part["kind"] == "date":
                if v not in ("", None):
                    try:
                        datetime.date.fromisoformat(str(v))
                    except ValueError as exc:
                        raise ApiError(f"Enter a valid date for \"{part['label']}\" in: {label}") from exc
            elif v not in ("", None) and (not isinstance(v, str) or len(v) > 5000):
                raise bad
        if question["required"] and any(v in ("", None) for v in value):
            raise ApiError(f"Fill in every row of: {label}")
    elif qtype == "date":
        try:
            datetime.date.fromisoformat(str(value))
        except ValueError as exc:
            raise ApiError(f"Enter a valid date for: {label}") from exc


def answer_text(question, value) -> str:
    """An answer as plain text for exports: "50 hectares", "Total area: 50 ha; Notes: ...", extra rows
    listed after it, and a dash when there is nothing."""
    answer, extra = split_answer(value)
    lines = []
    unit = getattr(question, "unit", "") or ""
    parts = getattr(question, "parts", None) or []
    if not is_empty(answer):
        if question.type == "table" and isinstance(answer, list):
            for part, v in zip(parts, answer):
                if v not in ("", None):
                    lines.append(f"{part['label']}: {v}{' ' + part['unit'] if part.get('unit') else ''}")
        elif isinstance(answer, list):
            lines.append(", ".join(str(v) for v in answer))
        else:
            lines.append(f"{answer}{' ' + unit if unit and question.type == 'number' else ''}")
    lines += [f"{r['label']}: {r['value']}" if r["label"] else r["value"] for r in extra]
    return "\n".join(lines) if lines else "—"
