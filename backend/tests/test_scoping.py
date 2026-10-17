"""Who must act on a survey, decided from its status and its three people."""
from types import SimpleNamespace

from apps.surveys.scoping import task_for


def survey(status, responder="r", reviewer="v", approver="a"):
    return SimpleNamespace(status=status, responder_id=responder, reviewer_id=reviewer, approver_id=approver)


def person(pk):
    return SimpleNamespace(pk=pk)


def test_the_responder_responds_to_a_new_survey():
    assert task_for(survey("awaiting_response"), person("r")) == {"role": "responder", "action": "Respond"}


def test_the_responder_revises_a_returned_survey():
    assert task_for(survey("returned"), person("r")) == {"role": "responder", "action": "Revise and resubmit"}


def test_the_reviewer_reviews_once_submitted():
    assert task_for(survey("awaiting_review"), person("v")) == {"role": "reviewer", "action": "Review"}


def test_the_approver_approves_once_reviewed():
    assert task_for(survey("awaiting_approval"), person("a")) == {"role": "approver", "action": "Approve"}


def test_nobody_has_a_task_on_a_finished_or_unpublished_survey():
    for status in ("draft", "approved", "closed"):
        for who in "rva":
            assert task_for(survey(status), person(who)) is None


def test_a_person_only_has_a_task_at_their_own_stage():
    assert task_for(survey("awaiting_review"), person("r")) is None  # the respondent is done
    assert task_for(survey("awaiting_review"), person("a")) is None  # the approver is not up yet
    assert task_for(survey("awaiting_response"), person("v")) is None
