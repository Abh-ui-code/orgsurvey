"""Notes pinned to questions when a survey is returned."""
from types import SimpleNamespace

import pytest

from apps.core.exceptions import ApiError
from apps.surveys import services


@pytest.fixture
def survey_with_questions(monkeypatch):
    questions = [SimpleNamespace(id="q1", pk="q1"), SimpleNamespace(id="q2", pk="q2")]
    monkeypatch.setattr(services, "all_questions", lambda survey: questions)
    return questions


def test_blank_notes_are_dropped(survey_with_questions):
    notes = services._clean_question_comments(None, [{"question_id": "q1", "text": "  "}, {"question_id": "q2", "text": " Fix this "}])
    assert [(q.id, text) for q, text in notes] == [("q2", "Fix this")]


def test_a_note_on_an_unknown_question_is_rejected(survey_with_questions):
    with pytest.raises(ApiError):
        services._clean_question_comments(None, [{"question_id": "nope", "text": "hi"}])


def test_only_the_last_note_per_question_is_kept(survey_with_questions):
    notes = services._clean_question_comments(None, [{"question_id": "q1", "text": "a"}, {"question_id": "q1", "text": "b"}])
    assert [text for _, text in notes] == ["b"]


def test_returning_needs_a_comment_or_a_note(survey_with_questions):
    with pytest.raises(ApiError):
        services._return(SimpleNamespace(), SimpleNamespace(), "  ", [], "responder", [], "returned")
