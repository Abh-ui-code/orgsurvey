"""
One definition of what a question is and what counts as a valid answer,
shared by the question bank and by surveys, so the two can never disagree.
"""
import datetime

from apps.core.exceptions import ApiError

TYPES = ["text", "single_choice", "multi_choice", "rating", "yes_no", "number", "date"]
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
    return {
        "text": text,
        "type": qtype,
        "options": options,
        "hint": str(data.get("hint", "")).strip(),
        "required": bool(data.get("required", True)),
    }


def is_empty(value) -> bool:
    return value is None or value == "" or (isinstance(value, list) and len(value) == 0)


def validate_answer(question: dict, value) -> None:
    """Raise ApiError unless `value` is an acceptable answer to `question`
    (a dict with text/type/options/required)."""
    label = f'"{question["text"]}"'
    if is_empty(value):
        if question["required"]:
            raise ApiError(f"Please answer: {label}")
        return
    qtype = question["type"]
    bad = ApiError(f"That isn't a valid answer for: {label}")
    if qtype == "text":
        if not isinstance(value, str) or len(value) > 5000:
            raise bad
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
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ApiError(f"Enter a number for: {label}")
    elif qtype == "date":
        try:
            datetime.date.fromisoformat(str(value))
        except ValueError as exc:
            raise ApiError(f"Enter a valid date for: {label}") from exc
