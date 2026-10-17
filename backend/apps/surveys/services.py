"""
Everything a survey can do, and every rule about when. Views and serializers
stay thin; the lifecycle reads top to bottom here.

    draft --publish--> awaiting_response --responder submits--> awaiting_review
    awaiting_review   --reviewer passes--> awaiting_approval
    awaiting_approval --approver approves--> approved
    the reviewer may return it to the respondent --> returned;
    the approver may return it to the respondent or both --> returned, or to
    the reviewer alone --> awaiting_review. A return carries a comment and/or
    notes pinned to individual questions.
    the respondent revises and resubmits --> awaiting_review
    an administrator may close a live survey at any point.

Structure (sections, questions) is editable only while a draft: once
published, the respondent, reviewer and approver all see exactly the same form.
"""
from django.db import transaction
from django.db.models import Max
from django.utils import timezone

from apps.core.exceptions import ApiError
from apps.core.question_types import is_empty, validate_answer
from apps.organisation.models import Member
from apps.surveys.models import QuestionComment, Section, Survey, SurveyEvent, SurveyQuestion

FROZEN = "Published surveys can't be changed. Duplicate it to make changes."
ROLES = ("responder", "reviewer", "approver")
RETURN_AUDIENCES = ("responder", "reviewer", "both")
QUESTION_FIELDS = ("text", "type", "options", "hint", "required")


def _log(survey, action, by, comment="", audience="", snapshot=None):
    return SurveyEvent.objects.create(
        survey=survey, action=action, by=by, comment=(comment or "").strip(), audience=audience, snapshot=snapshot or {}
    )


def require_draft(survey):
    if survey.status != "draft":
        raise ApiError(FROZEN)


def all_questions(survey):
    return list(SurveyQuestion.objects.filter(section__survey=survey).order_by("section__order", "order"))


# =========================================================== details
@transaction.atomic
def create_draft(*, title, category, target_unit, description, creator) -> Survey:
    if not category.is_active:
        raise ApiError("That category is switched off. Choose another.")
    survey = Survey.objects.create(
        title=title.strip(), category=category, target_unit=target_unit,
        description=(description or "").strip(), created_by=creator,
    )
    Section.objects.create(survey=survey, order=0, title="Section 1")
    _log(survey, "created", creator)
    return survey


LIVE_EDITABLE = {"due_date", *ROLES}


@transaction.atomic
def update_survey(survey: Survey, **fields) -> Survey:
    """Details and assignment. While a draft, anything; once live, only the
    due date and who the three people are (people leave, deadlines move)."""
    if survey.status in ("approved", "closed"):
        raise ApiError("This survey is finished and can't be changed.")
    if survey.status != "draft" and set(fields) - LIVE_EDITABLE:
        raise ApiError("Once published, only the due date and the three people can change.")

    category = fields.get("category")
    if category is not None and category.pk != survey.category_id and not category.is_active:
        raise ApiError("That category is switched off. Choose another.")

    for role in ROLES:
        person = fields.get(role)
        if person is not None and not Member.objects.filter(user=person, is_active=True).exists():
            raise ApiError("Choose people who are active in this workspace.")

    if "title" in fields:
        title = fields["title"].strip()
        if not title:
            raise ApiError("Give the survey a title.")
        fields["title"] = title
    for name, value in fields.items():
        setattr(survey, name, value)

    people = [p for p in (survey.responder_id, survey.reviewer_id, survey.approver_id) if p]
    if len(set(people)) != len(people):
        raise ApiError("The respondent, reviewer and approver must be three different people.")
    if survey.status != "draft" and len(people) != 3:
        raise ApiError("A published survey needs all three people.")
    survey.save()
    return survey


# ============================================================ builder
def _next_order(queryset) -> int:
    top = queryset.aggregate(top=Max("order"))["top"]
    return 0 if top is None else top + 1


@transaction.atomic
def add_section(survey: Survey, *, title, description="") -> Section:
    require_draft(survey)
    return Section.objects.create(survey=survey, order=_next_order(survey.sections), title=title, description=description)


@transaction.atomic
def update_section(section: Section, **fields) -> Section:
    require_draft(section.survey)
    for name, value in fields.items():
        setattr(section, name, value)
    section.save()
    return section


@transaction.atomic
def delete_section(section: Section):
    survey = section.survey
    require_draft(survey)
    if survey.sections.count() <= 1:
        raise ApiError("A survey needs at least one section.")
    section.delete()


def _move(items, target, direction):
    """Swap `target` with its neighbour and renumber the whole list, so order
    values stay a clean 0..n-1 whatever deletions came before."""
    if direction not in ("up", "down"):
        raise ApiError("Direction must be 'up' or 'down'.")
    items = list(items)
    i = next(k for k, item in enumerate(items) if item.pk == target.pk)
    j = i - 1 if direction == "up" else i + 1
    if 0 <= j < len(items):
        items[i], items[j] = items[j], items[i]
    for order, item in enumerate(items):
        if item.order != order:
            item.order = order
            item.save(update_fields=["order"])


@transaction.atomic
def move_section(section: Section, direction):
    require_draft(section.survey)
    _move(section.survey.sections.all(), section, direction)


@transaction.atomic
def add_question(section: Section, **fields) -> SurveyQuestion:
    require_draft(section.survey)
    return SurveyQuestion.objects.create(section=section, order=_next_order(section.questions), **fields)


@transaction.atomic
def add_question_from_bank(section: Section, bank_question) -> SurveyQuestion:
    """Copy a bank question into the section, remembering where it came from."""
    fields = {name: getattr(bank_question, name) for name in QUESTION_FIELDS}
    question = add_question(section, **fields)
    question.bank_question = bank_question
    question.save(update_fields=["bank_question"])
    return question


@transaction.atomic
def update_question(question: SurveyQuestion, **fields) -> SurveyQuestion:
    require_draft(question.section.survey)
    for name, value in fields.items():
        setattr(question, name, value)
    question.save()
    return question


@transaction.atomic
def delete_question(question: SurveyQuestion):
    require_draft(question.section.survey)
    question.delete()


@transaction.atomic
def move_question(question: SurveyQuestion, direction):
    require_draft(question.section.survey)
    _move(question.section.questions.all(), question, direction)


# ======================================================== lifecycle
def readiness(survey: Survey) -> list[dict]:
    """The checklist shown before publishing -- the same rules publish() enforces."""
    people = [survey.responder_id, survey.reviewer_id, survey.approver_id]
    return [
        {"key": "questions", "label": "At least one question", "ok": SurveyQuestion.objects.filter(section__survey=survey).exists()},
        {"key": "people", "label": "A respondent, a reviewer and an approver", "ok": all(people)},
        {"key": "distinct", "label": "Three different people", "ok": all(people) and len(set(people)) == 3},
    ]


@transaction.atomic
def publish(survey: Survey, by) -> Survey:
    require_draft(survey)
    missing = [item["label"] for item in readiness(survey) if not item["ok"]]
    if missing:
        raise ApiError("Can't publish yet. Still needed: " + "; ".join(missing) + ".")
    survey.status = "awaiting_response"
    survey.published_at = timezone.now()
    survey.save(update_fields=["status", "published_at"])
    _log(survey, "published", by)
    return survey


@transaction.atomic
def close(survey: Survey, by, comment="") -> Survey:
    if survey.status not in Survey.LIVE:
        raise ApiError("Only a survey that is in progress can be closed.")
    survey.status = "closed"
    survey.closed_at = timezone.now()
    survey.save(update_fields=["status", "closed_at"])
    _log(survey, "closed", by, comment)
    return survey


@transaction.atomic
def duplicate(survey: Survey, by) -> Survey:
    copy = Survey.objects.create(
        category=survey.category, title=f"Copy of {survey.title}"[:255], description=survey.description,
        instructions=survey.instructions, target_unit=survey.target_unit, created_by=by,
        responder=survey.responder, reviewer=survey.reviewer, approver=survey.approver,
    )
    for section in survey.sections.all():
        new_section = Section.objects.create(survey=copy, order=section.order, title=section.title, description=section.description)
        for q in section.questions.all():
            SurveyQuestion.objects.create(
                section=new_section, order=q.order, bank_question=q.bank_question,
                **{name: getattr(q, name) for name in QUESTION_FIELDS},
            )
    _log(copy, "created", by, f"Duplicated from “{survey.title}”")
    return copy


# ====================================================== the workflow
def _expect(survey, *allowed):
    if survey.status not in allowed:
        raise ApiError("This survey is not at the right stage for that action.")


@transaction.atomic
def submit_response(survey: Survey, user, answers) -> Survey:
    if survey.responder_id != user.pk:
        raise ApiError("Only the assigned respondent can submit.")
    _expect(survey, "awaiting_response", "returned")
    if not isinstance(answers, dict):
        raise ApiError("Answers are required.")
    cleaned = {}
    for q in all_questions(survey):
        value = answers.get(str(q.id))
        validate_answer({"text": q.text, "type": q.type, "options": q.options, "required": q.required}, value)
        if value not in (None, "", []):
            cleaned[str(q.id)] = value.strip() if isinstance(value, str) else value
    survey.answers = cleaned
    survey.draft_answers = {}
    survey.status = "awaiting_review"
    survey.save(update_fields=["answers", "draft_answers", "status"])
    _log(survey, "submitted", user, snapshot=cleaned)
    return survey


@transaction.atomic
def save_draft(survey: Survey, user, answers) -> Survey:
    """Keep the respondent's work in progress. Required answers are not
    enforced yet (that happens on submit), but each answer given must still be
    the right shape for its question."""
    if survey.responder_id != user.pk:
        raise ApiError("Only the assigned respondent can save a draft.")
    _expect(survey, "awaiting_response", "returned")
    if not isinstance(answers, dict):
        raise ApiError("Answers are required.")
    known = {str(q.id): q for q in all_questions(survey)}
    cleaned = {}
    for question_id, value in answers.items():
        q = known.get(question_id)
        if q is None or is_empty(value):
            continue
        validate_answer({"text": q.text, "type": q.type, "options": q.options, "required": False}, value)
        cleaned[question_id] = value.strip() if isinstance(value, str) else value
    survey.draft_answers = cleaned
    survey.save(update_fields=["draft_answers"])
    return survey


def _clean_question_comments(survey, items):
    """Validate notes pinned to questions: [{question_id, text}, ...]. Blank
    notes are dropped; a note on a question outside this survey is an error."""
    known = {str(q.id): q for q in all_questions(survey)}
    cleaned = {}
    for item in items or []:
        text = (item.get("text") or "").strip()
        if not text:
            continue
        question = known.get(str(item.get("question_id")))
        if question is None:
            raise ApiError("A comment refers to a question that isn't in this survey.")
        cleaned[question.pk] = (question, text)
    return list(cleaned.values())


def _return(survey, user, comment, question_comments, audience):
    """Send the survey back. A return needs something to act on: a general
    comment, a note on a question, or both."""
    notes = _clean_question_comments(survey, question_comments)
    if not (comment or "").strip() and not notes:
        raise ApiError("Add a comment, or a note on a question, explaining what to fix.")
    survey.status = "awaiting_review" if audience == "reviewer" else "returned"
    survey.save(update_fields=["status"])
    event = _log(survey, "returned", user, comment, audience)
    QuestionComment.objects.bulk_create(
        [QuestionComment(event=event, question=q, author=user, text=text) for q, text in notes]
    )


@transaction.atomic
def review(survey: Survey, user, decision, comment, question_comments=None, audience="responder") -> Survey:
    if survey.reviewer_id != user.pk:
        raise ApiError("Only the assigned reviewer can review.")
    _expect(survey, "awaiting_review")
    if decision not in ("pass", "return"):
        raise ApiError("Decision must be 'pass' or 'return'.")
    if decision == "return":
        # The reviewer can only send it back down the chain, to the respondent.
        _return(survey, user, comment, question_comments, "responder")
    else:
        survey.status = "awaiting_approval"
        survey.save(update_fields=["status"])
        _log(survey, "reviewed", user, comment)
    return survey


@transaction.atomic
def approve(survey: Survey, user, decision, comment, question_comments=None, audience="responder") -> Survey:
    if survey.approver_id != user.pk:
        raise ApiError("Only the assigned approver can approve.")
    _expect(survey, "awaiting_approval")
    if decision not in ("approve", "return"):
        raise ApiError("Decision must be 'approve' or 'return'.")
    if decision == "return":
        if audience not in RETURN_AUDIENCES:
            raise ApiError("Choose who to return it to: the respondent, the reviewer or both.")
        _return(survey, user, comment, question_comments, audience)
    else:
        survey.status = "approved"
        survey.save(update_fields=["status"])
        _log(survey, "approved", user, comment)
    return survey
