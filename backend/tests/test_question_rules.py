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
    assert out == {"text": "How are you?", "type": "text", "unit": "", "parts": [], "options": [], "hint": "be honest", "required": False}


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


# ---------------------------------------------------------------- units, tables and extra rows
from apps.core.question_types import answer_text, clean_answer  # noqa: E402

AREA = {"text": "Total area?", "type": "number", "unit": "hectares", "options": [], "parts": [], "required": True}
MIXED = {
    "text": "Employees", "type": "table", "unit": "", "options": [], "required": True,
    "parts": [
        {"label": "Total employees", "kind": "number", "unit": "employees"},
        {"label": "Reason for change", "kind": "text", "unit": ""},
    ],
}


def test_a_unit_is_kept_only_on_number_questions():
    assert clean_question_fields({"text": "Area", "type": "number", "unit": " hectares "})["unit"] == "hectares"
    assert clean_question_fields({"text": "Area", "type": "text", "unit": "hectares"})["unit"] == ""


def test_a_table_question_needs_labelled_rows_of_a_known_kind():
    ok = clean_question_fields({"text": "T", "type": "table", "parts": [{"label": "A", "kind": "number", "unit": "ha"}, {"label": "B", "kind": "text", "unit": "ha"}]})
    assert ok["parts"] == [{"label": "A", "kind": "number", "unit": "ha"}, {"label": "B", "kind": "text", "unit": ""}]
    for parts in ([], [{"label": "", "kind": "text"}], [{"label": "A", "kind": "emoji"}]):
        with pytest.raises(ApiError):
            clean_question_fields({"text": "T", "type": "table", "parts": parts})


def test_a_table_answer_has_one_value_per_row_and_numbers_where_asked():
    validate_answer(MIXED, [120, "Hiring drive"])
    for bad in ([120], ["lots", "x"], "text", [120, "x", "extra"], [float("inf"), "x"]):
        with pytest.raises(ApiError):
            validate_answer(MIXED, bad)


def test_a_required_table_needs_every_row_but_an_optional_one_may_be_partial():
    with pytest.raises(ApiError):
        validate_answer(MIXED, [120, ""])
    with pytest.raises(ApiError):
        validate_answer(MIXED, ["", ""])
    validate_answer({**MIXED, "required": False}, [120, ""])
    validate_answer({**MIXED, "required": False}, ["", ""])


def test_extra_rows_ride_along_with_any_answer():
    assert clean_answer(AREA, {"answer": 50, "extra": [{"label": " North plot ", "value": " 20 "}, {"label": "", "value": ""}]}) == {
        "answer": 50, "extra": [{"label": "North plot", "value": "20"}]}
    assert clean_answer(AREA, {"answer": 50, "extra": []}) == 50
    assert clean_answer(MIXED, {"answer": [1, "a"], "extra": [{"label": "x", "value": "y"}]})["answer"] == [1, "a"]


def test_extra_rows_do_not_stand_in_for_a_required_answer_and_must_be_well_formed():
    with pytest.raises(ApiError):
        clean_answer(AREA, {"answer": "", "extra": [{"label": "x", "value": "1"}]})
    for bad in ({"answer": 1, "extra": "nope"}, {"answer": 1, "extra": [{"label": 3, "value": "x"}]}, {"answer": 1, "other": 2}, {"answer": 1, "extra": [{"label": "x", "value": "y"}] * 31}):
        with pytest.raises(ApiError):
            clean_answer(AREA, bad)
    assert clean_answer({**AREA, "required": False}, {"answer": None, "extra": [{"label": "x", "value": "1"}]}) == {"answer": None, "extra": [{"label": "x", "value": "1"}]}


def test_answers_read_back_as_text_with_their_units():
    from types import SimpleNamespace as NS
    assert answer_text(NS(**AREA), 50) == "50 hectares"
    assert answer_text(NS(**MIXED), [120, "Hiring"]) == "Total employees: 120 employees\nReason for change: Hiring"
    assert answer_text(NS(**AREA), {"answer": 50, "extra": [{"label": "North", "value": "20"}]}) == "50 hectares\nNorth: 20"
    assert answer_text(NS(**AREA), None) == "—"


def test_a_short_text_answer_is_one_line_of_text_with_an_optional_label():
    short = {"text": "Ratio?", "type": "short_text", "unit": "highest-paid : median", "options": [], "parts": [], "required": True}
    validate_answer(short, "12.5:1")
    for bad in (12.5, ["3:1"], "x" * 201):
        with pytest.raises(ApiError):
            validate_answer(short, bad)
    assert clean_question_fields({"text": "R", "type": "short_text", "unit": " a : b "})["unit"] == "a : b"


def test_a_table_can_have_date_rows():
    t = {"text": "Use", "type": "table", "unit": "", "options": [], "required": True,
         "parts": [{"label": "Org", "kind": "text", "unit": ""}, {"label": "Start", "kind": "date", "unit": ""}]}
    validate_answer(t, ["Acme", "2025-01-01"])
    for bad in (["Acme", "01/01/2025"], ["Acme", 5]):
        with pytest.raises(ApiError):
            validate_answer(t, bad)
    assert clean_question_fields({"text": "T", "type": "table", "parts": [{"label": "S", "kind": "date", "unit": "x"}]})["parts"] == [{"label": "S", "kind": "date", "unit": ""}]
