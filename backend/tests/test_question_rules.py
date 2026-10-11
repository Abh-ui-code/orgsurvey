"""The rules every answer and every question must obey. Pure functions, no database."""
import pytest

from apps.core.exceptions import ApiError
from apps.core.question_types import clean_question_fields, validate_answer


def q(type_, required=True, options=None):
    return {"text": "Q?", "type": type_, "options": options or [], "required": required}


# ------------------------------------------------------------------ answers
@pytest.mark.parametrize(
    "question, value",
    [
        (q("text"), "hello"),
        (q("rating"), 1),
        (q("rating"), 5),
        (q("yes_no"), "Yes"),
        (q("yes_no"), "No"),
        (q("single_choice", options=["a", "b"]), "a"),
        (q("multi_choice", options=["a", "b", "c"]), ["a", "c"]),
        (q("number"), 0),
        (q("number"), 3.5),
        (q("date"), "2030-02-28"),
    ],
)
def test_valid_answers_pass(question, value):
    validate_answer(question, value)  # raises nothing


@pytest.mark.parametrize(
    "question, value",
    [
        (q("rating"), 0),
        (q("rating"), 6),
        (q("rating"), "4"),
        (q("rating"), 4.5),
        (q("rating"), True),  # a bool is an int in Python; it must not count as a rating
        (q("yes_no"), "yes"),
        (q("yes_no"), True),
        (q("single_choice", options=["a", "b"]), "z"),
        (q("single_choice", options=["a", "b"]), ["a"]),
        (q("multi_choice", options=["a", "b"]), "a"),
        (q("multi_choice", options=["a", "b"]), ["a", "z"]),
        (q("multi_choice", options=["a", "b"]), ["a", "a"]),
        (q("number"), "7"),
        (q("number"), True),
        (q("date"), "31/01/2030"),
        (q("date"), "2030-02-30"),
        (q("text"), 5),
        (q("text"), "x" * 5001),
    ],
)
def test_invalid_answers_are_refused(question, value):
    with pytest.raises(ApiError):
        validate_answer(question, value)


@pytest.mark.parametrize("empty", [None, "", []])
def test_a_required_question_needs_an_answer(empty):
    with pytest.raises(ApiError):
        validate_answer(q("text", required=True), empty)


@pytest.mark.parametrize("empty", [None, "", []])
def test_an_optional_question_may_be_left_blank(empty):
    validate_answer(q("text", required=False), empty)


def test_an_optional_answer_that_is_given_must_still_be_valid():
    with pytest.raises(ApiError):
        validate_answer(q("rating", required=False), 9)


# ---------------------------------------------------------------- questions
def test_a_plain_question_is_cleaned():
    out = clean_question_fields({"text": "  How are you?  ", "type": "text", "hint": "  be honest ", "required": False})
    assert out == {"text": "How are you?", "type": "text", "options": [], "hint": "be honest", "required": False}


def test_options_are_trimmed_and_blanks_dropped():
    out = clean_question_fields({"text": "Pick", "type": "single_choice", "options": [" a ", "", "b"]})
    assert out["options"] == ["a", "b"]


def test_options_are_ignored_for_non_choice_types():
    assert clean_question_fields({"text": "Rate", "type": "rating", "options": ["x", "y"]})["options"] == []


@pytest.mark.parametrize(
    "data",
    [
        {"text": " ", "type": "text"},
        {"text": "q", "type": "galaxy"},
        {"text": "q", "type": "single_choice", "options": ["only-one"]},
        {"text": "q", "type": "multi_choice", "options": ["a", "a"]},
    ],
)
def test_bad_questions_are_refused(data):
    with pytest.raises(ApiError):
        clean_question_fields(data)
