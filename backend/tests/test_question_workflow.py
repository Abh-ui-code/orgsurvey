"""Choosing which questions a decision covers."""
from types import SimpleNamespace as NS

import pytest

from apps.core.exceptions import ApiError
from apps.surveys import services


@pytest.fixture
def survey_questions(monkeypatch):
    questions = [
        NS(id="q1", pk="q1", responder_id="r1", status="awaiting_review"),
        NS(id="q2", pk="q2", responder_id="r1", status="awaiting_review"),
        NS(id="q3", pk="q3", responder_id="r2", status="awaiting_response"),
        NS(id="q4", pk="q4", responder_id="r2", status="awaiting_approval"),
    ]
    monkeypatch.setattr(services, "all_questions", lambda survey: questions)
    return questions


def test_with_no_selection_a_decision_covers_everything_waiting(survey_questions):
    assert [q.id for q in services._targets(None, None, ("awaiting_review",))] == ["q1", "q2"]


def test_a_selection_narrows_the_decision(survey_questions):
    assert [q.id for q in services._targets(None, ["q2"], ("awaiting_review",))] == ["q2"]


def test_a_selected_question_at_the_wrong_stage_is_refused(survey_questions):
    with pytest.raises(ApiError):
        services._targets(None, ["q1", "q4"], ("awaiting_review",))


def test_an_unknown_question_is_refused(survey_questions):
    with pytest.raises(ApiError):
        services._targets(None, ["nope"], ("awaiting_review",))


def test_a_respondent_can_only_act_on_their_own_questions(survey_questions):
    assert [q.id for q in services._targets(None, None, ("awaiting_response",), owned_by=NS(pk="r2"))] == ["q3"]
    with pytest.raises(ApiError):
        services._targets(None, ["q1"], ("awaiting_review",), owned_by=NS(pk="r2"))


def test_nothing_waiting_is_an_error(survey_questions):
    with pytest.raises(ApiError):
        services._targets(None, None, ("approved",))


def test_a_note_must_be_on_a_question_the_decision_covers(survey_questions):
    covered = survey_questions[:1]
    with pytest.raises(ApiError):
        services._clean_question_comments(None, [{"question_id": "q2", "text": "x"}], covered)
