"""Notes and attached files a respondent leaves on a question."""
from types import SimpleNamespace as NS

import pytest

from apps.core.exceptions import ApiError
from apps.surveys import services


def test_notes_are_kept_only_for_allowed_questions_and_blanks_dropped():
    cleaned = services._clean_notes({"q1": "  see report ", "q2": "other person's", "q3": "   "}, {"q1", "q3"})
    assert cleaned == {"q1": "see report"}


def test_a_note_has_a_length_limit():
    with pytest.raises(ApiError):
        services._clean_notes({"q1": "x" * (services.NOTE_MAX + 1)}, {"q1"})


def test_notes_must_be_a_mapping():
    with pytest.raises(ApiError):
        services._clean_notes(["nope"], {"q1"})


def files(count):
    """A stand-in for question.attachments holding `count` files."""
    return NS(filter=lambda **kw: NS(count=lambda: count))


@pytest.fixture
def open_question(monkeypatch):
    survey = NS(status="in_progress")
    question = NS(id="q1", pk="q1", responder_id="me", status="awaiting_response", attachments=files(0))
    monkeypatch.setattr(services, "all_questions", lambda s: [question])
    return survey, question


def upload(name="evidence.pdf", size=1000):
    return NS(name=name, size=size, content_type="application/pdf")


def test_only_the_respondent_can_attach_to_an_open_question(open_question):
    survey, _ = open_question
    with pytest.raises(ApiError):
        services.add_attachment(survey, NS(pk="someone-else"), "q1", upload())


def test_a_submitted_question_cannot_take_new_files(open_question):
    survey, question = open_question
    question.status = "awaiting_review"
    with pytest.raises(ApiError):
        services.add_attachment(survey, NS(pk="me"), "q1", upload())


@pytest.mark.parametrize("name,size", [("virus.exe", 10), ("big.pdf", services.ATTACH_MAX_BYTES + 1)])
def test_bad_files_are_refused(open_question, name, size):
    survey, _ = open_question
    with pytest.raises(ApiError):
        services.add_attachment(survey, NS(pk="me"), "q1", upload(name, size))


def test_a_question_has_a_file_limit(open_question):
    survey, question = open_question
    question.attachments = files(services.ATTACH_MAX_FILES)
    with pytest.raises(ApiError):
        services.add_attachment(survey, NS(pk="me"), "q1", upload())


# ------------------------------------------------ files from the reviewer / approver
@pytest.fixture
def waiting(monkeypatch):
    survey = NS(status="in_progress", reviewer_id="rev", approver_id="app")
    review = NS(id="q1", pk="q1", responder_id="me", status="awaiting_review", attachments=files(0))
    approval = NS(id="q2", pk="q2", responder_id="me", status="awaiting_approval", attachments=files(0))
    monkeypatch.setattr(services, "all_questions", lambda s: [review, approval])
    return survey


def test_the_reviewer_cannot_attach_to_a_question_waiting_on_the_approver(waiting):
    with pytest.raises(ApiError):
        services.add_review_attachment(waiting, NS(pk="rev"), "q2", upload())


def test_the_respondent_cannot_attach_review_files(waiting):
    with pytest.raises(ApiError):
        services.add_review_attachment(waiting, NS(pk="me"), "q1", upload())


def test_review_files_have_the_same_limits(waiting):
    with pytest.raises(ApiError):
        services.add_review_attachment(waiting, NS(pk="rev"), "q1", upload("tool.exe"))


def test_a_sent_review_file_cannot_be_removed():
    sent = NS(kind="review", uploaded_by_id="rev", comment_id="c1")
    with pytest.raises(ApiError):
        services.delete_attachment(NS(), NS(pk="rev"), sent)


def test_only_the_author_can_remove_an_unsent_review_file():
    unsent = NS(kind="review", uploaded_by_id="rev", comment_id=None)
    with pytest.raises(ApiError):
        services.delete_attachment(NS(), NS(pk="someone-else"), unsent)


# ------------------------------------------------ who may open a reviewer's file
from apps.surveys.serializers import can_open_review_file  # noqa: E402


def review_file(audience="responder", action="returned", sent=True, author="rev"):
    comment = NS(event=NS(action=action, audience=audience)) if sent else None
    return NS(uploaded_by_id=author, comment=comment, question=NS(responder_id="me"))


def test_the_respondent_opens_files_returned_to_them():
    assert can_open_review_file(review_file("responder"), NS(pk="me"), False)
    assert can_open_review_file(review_file("both"), NS(pk="me"), False)


def test_the_respondent_does_not_get_files_returned_only_to_the_reviewer():
    assert not can_open_review_file(review_file("reviewer"), NS(pk="me"), False)


def test_the_respondent_does_not_get_files_that_were_only_passed_on():
    assert not can_open_review_file(review_file(action="reviewed", audience=""), NS(pk="me"), False)


def test_an_unsent_file_is_private_to_its_author():
    unsent = review_file(sent=False)
    assert can_open_review_file(unsent, NS(pk="rev"), False)
    assert not can_open_review_file(unsent, NS(pk="app"), False)
    assert not can_open_review_file(unsent, NS(pk="admin"), True)


def test_the_approver_and_admin_open_sent_files():
    assert can_open_review_file(review_file(), NS(pk="app"), False)
    assert can_open_review_file(review_file(), NS(pk="admin"), True)
