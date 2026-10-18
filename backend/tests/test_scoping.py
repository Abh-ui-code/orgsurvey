"""Question-level rules: who sees which question, and what each person must do."""
from types import SimpleNamespace as NS

from apps.surveys.scoping import can_see, stage_counts, task_for, visible_questions


class Many:
    def __init__(self, items):
        self._items = items

    def all(self):
        return self._items


def question(responder, status="awaiting_response", progress=0):
    return NS(pk=f"{responder}-{status}", responder_id=responder, status=status, progress=progress)


def survey(*questions, status="in_progress"):
    return NS(status=status, reviewer_id="v", approver_id="a", sections=Many([NS(questions=Many(list(questions)))]))


def person(pk):
    return NS(pk=pk)


def test_a_respondent_sees_only_their_own_questions():
    mine, theirs = question("r1"), question("r2")
    s = survey(mine, theirs)
    assert visible_questions(s, person("r1"), False) == [mine]


def test_the_reviewer_sees_a_question_once_it_is_submitted_and_keeps_seeing_it():
    waiting = question("r1")
    submitted = question("r1", "awaiting_review", 1)
    returned = question("r1", "returned", 1)
    s = survey(waiting, submitted, returned)
    assert visible_questions(s, person("v"), False) == [submitted, returned]


def test_the_approver_sees_only_questions_that_passed_review():
    submitted = question("r1", "awaiting_review", 1)
    passed = question("r1", "awaiting_approval", 2)
    s = survey(submitted, passed)
    assert visible_questions(s, person("a"), False) == [passed]


def test_administrators_see_everything():
    qs = [question("r1"), question("r2", "approved", 2)]
    assert visible_questions(survey(*qs), person("admin"), True) == qs


def test_half_approved_half_pending_each_person_acts_on_their_own_part():
    s = survey(question("r1", "approved", 2), question("r2"), question("r2", "awaiting_review", 1))
    assert task_for(s, person("r2")) == {"role": "responder", "action": "Respond", "count": 1}
    assert task_for(s, person("r1")) is None  # all of r1's work is approved
    assert task_for(s, person("v")) == {"role": "reviewer", "action": "Review", "count": 1}
    assert task_for(s, person("a")) is None  # nothing has reached the approver


def test_a_returned_question_asks_the_respondent_to_revise():
    s = survey(question("r1", "returned", 1))
    assert task_for(s, person("r1")) == {"role": "responder", "action": "Revise and resubmit", "count": 1}


def test_the_approver_acts_on_questions_awaiting_approval():
    s = survey(question("r1", "awaiting_approval", 2), question("r1", "awaiting_approval", 2))
    assert task_for(s, person("a")) == {"role": "approver", "action": "Approve", "count": 2}


def test_nobody_has_a_task_on_a_finished_or_unpublished_survey():
    for status in ("draft", "approved", "closed"):
        s = survey(question("r1"), status=status)
        for who in ("r1", "v", "a"):
            assert task_for(s, person(who)) is None


def test_stage_counts_tally_each_status():
    counts = stage_counts([question("r1"), question("r1"), question("r2", "approved", 2)])
    assert counts["awaiting_response"] == 2 and counts["approved"] == 1 and counts["total"] == 3


def test_can_see_matches_visible_questions():
    q = question("r1", "awaiting_review", 1)
    s = survey(q)
    assert can_see(q, s, person("v"), False) and not can_see(q, s, person("a"), False) and not can_see(q, s, person("r2"), False)
