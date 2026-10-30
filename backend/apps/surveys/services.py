"""
Everything a survey can do, and every rule about when. Views and serializers
stay thin; the lifecycle reads top to bottom here.

The workflow runs per question. Each question has one respondent and moves on
its own, so a survey of 100 questions can have 50 approved while the other 50
have not been answered yet:

    awaiting_response --respondent submits--> awaiting_review
    awaiting_review   --reviewer passes--> awaiting_approval
    awaiting_approval --approver approves--> approved
    the reviewer may return questions to the respondent --> returned;
    the approver may return them to the respondent or both --> returned, or to
    the reviewer alone --> awaiting_review. A return carries a comment and/or
    notes pinned to individual questions.
    the respondent revises and resubmits --> awaiting_review

The survey is `in_progress` from publishing until every question is approved,
then `approved`. An administrator may close a live survey at any point.

Structure (sections, questions) is editable only while a draft; who answers
which question can still change while it waits for its respondent.
"""
from django.db import transaction
from django.db.models import Max
from django.utils import timezone

from apps.core.exceptions import ApiError
from apps.core.question_types import is_empty, validate_answer
from apps.organisation.models import Member
from apps.surveys.models import QuestionComment, Section, Survey, SurveyEvent, SurveyQuestion
from apps.surveys.scoping import RESPONDER_OPEN

FROZEN = "Published surveys can't be changed. Duplicate it to make changes."
ROLES = ("reviewer", "approver")
RETURN_AUDIENCES = ("responder", "reviewer", "both")
QUESTION_FIELDS = ("text", "type", "options", "hint", "required")
STAGE_ERROR = "Those questions are not at the right stage for that action."


def _log(survey, action, by, comment="", audience="", snapshot=None, questions=()):
    event = SurveyEvent.objects.create(
        survey=survey, action=action, by=by, comment=(comment or "").strip(), audience=audience, snapshot=snapshot or {}
    )
    if questions:
        event.questions.set(questions)
    return event


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


LIVE_EDITABLE = {"due_date", "reviewer", "approver"}


def _active_member(person):
    if person is not None and not Member.objects.filter(user=person, is_active=True).exists():
        raise ApiError("Choose people who are active in this workspace.")


def _respondent_ids(survey) -> set:
    return set(
        SurveyQuestion.objects.filter(section__survey=survey, responder__isnull=False).values_list("responder_id", flat=True)
    )


def _check_people(survey):
    """The reviewer and approver are two different people, and neither answers
    any of the questions."""
    if survey.reviewer_id and survey.reviewer_id == survey.approver_id:
        raise ApiError("The reviewer and the approver must be different people.")
    if {survey.reviewer_id, survey.approver_id} & _respondent_ids(survey):
        raise ApiError("A respondent can't also be the reviewer or approver.")


@transaction.atomic
def update_survey(survey: Survey, **fields) -> Survey:
    """Details and assignment. While a draft, anything; once live, only the
    due date and who reviews and approves (people leave, deadlines move)."""
    if survey.status in ("approved", "closed"):
        raise ApiError("This survey is finished and can't be changed.")
    if survey.status != "draft" and set(fields) - LIVE_EDITABLE:
        raise ApiError("Once published, only the due date, the reviewer and the approver can change.")

    category = fields.get("category")
    if category is not None and category.pk != survey.category_id and not category.is_active:
        raise ApiError("That category is switched off. Choose another.")

    for role in ROLES:
        _active_member(fields.get(role))

    if "title" in fields:
        title = fields["title"].strip()
        if not title:
            raise ApiError("Give the survey a title.")
        fields["title"] = title
    for name, value in fields.items():
        setattr(survey, name, value)

    _check_people(survey)
    if survey.status != "draft" and not (survey.reviewer_id and survey.approver_id):
        raise ApiError("A published survey needs a reviewer and an approver.")
    survey.save()
    return survey


@transaction.atomic
def assign_questions(survey: Survey, assignments) -> Survey:
    """Give questions their respondent: [(question, person), ...]. One person
    per question, always. While live, a question can be handed to someone else
    only until it has been submitted (or after it is sent back)."""
    if survey.status not in ("draft", *Survey.LIVE):
        raise ApiError("This survey is finished and can't be changed.")
    questions = {q.pk: q for q in all_questions(survey)}
    # A GRI section goes to one person as a whole: every question in it, or none.
    given = {}
    for question, person in assignments:
        if question.pk in questions and question.section.gri_standard_id:
            given.setdefault(question.section_id, {})[question.pk] = person
    for section_id, chosen in given.items():
        whole = set(SurveyQuestion.objects.filter(section_id=section_id).values_list("pk", flat=True))
        if set(chosen) != whole or len({p.pk if p else None for p in chosen.values()}) > 1:
            raise ApiError(GRI_FIXED.split(".")[0] + ". Assign the whole section to one person.")
    for question, person in assignments:
        if question.pk not in questions:
            raise ApiError("A question in that list isn't part of this survey.")
        _active_member(person)
        if person is None and survey.status != "draft":
            raise ApiError("A published question needs a respondent.")
        if survey.status != "draft" and question.status not in RESPONDER_OPEN:
            raise ApiError("A question that has been submitted can't be reassigned until it is returned.")
        question.responder = person
        question.save(update_fields=["responder"])
    _check_people(survey)
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


GRI_FIXED = "GRI sections are added and assigned as a whole. Remove the section to change it."


def _not_gri(section):
    if section.gri_standard_id:
        raise ApiError(GRI_FIXED)


@transaction.atomic
def add_gri_section(survey: Survey, standard) -> Section:
    """Add a whole GRI Standard as a section, with every question in it."""
    require_draft(survey)
    if survey.sections.filter(gri_standard=standard).exists():
        raise ApiError(f"{standard.code} is already in this survey.")
    section = Section.objects.create(
        survey=survey, order=_next_order(survey.sections), title=f"{standard.code}: {standard.title}"[:255],
        description=standard.summary, gri_standard=standard,
    )
    for bank_question in standard.questions.order_by("gri_order"):
        fields = {name: getattr(bank_question, name) for name in QUESTION_FIELDS}
        SurveyQuestion.objects.create(
            section=section, order=_next_order(section.questions), bank_question=bank_question, **fields
        )
    return section


@transaction.atomic
def assign_section(section: Section, person) -> Survey:
    """Give a whole section to one respondent (or take it back, while a draft)."""
    survey = section.survey
    return assign_questions(survey, [(q, person) for q in section.questions.all()])


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
    _not_gri(section)
    _active_member(fields.get("responder"))
    return SurveyQuestion.objects.create(section=section, order=_next_order(section.questions), **fields)


@transaction.atomic
def add_question_from_bank(section: Section, bank_question) -> SurveyQuestion:
    """Copy a bank question into the section, remembering where it came from."""
    if bank_question.gri_standard_id:
        raise ApiError("GRI questions can't be added one by one. Add the whole GRI standard as a section.")
    fields = {name: getattr(bank_question, name) for name in QUESTION_FIELDS}
    question = add_question(section, **fields)
    question.bank_question = bank_question
    question.save(update_fields=["bank_question"])
    return question


@transaction.atomic
def update_question(question: SurveyQuestion, **fields) -> SurveyQuestion:
    require_draft(question.section.survey)
    _not_gri(question.section)
    _active_member(fields.get("responder"))
    for name, value in fields.items():
        setattr(question, name, value)
    question.save()
    return question


@transaction.atomic
def delete_question(question: SurveyQuestion):
    require_draft(question.section.survey)
    _not_gri(question.section)
    question.delete()


@transaction.atomic
def move_question(question: SurveyQuestion, direction):
    require_draft(question.section.survey)
    _not_gri(question.section)
    _move(question.section.questions.all(), question, direction)


# ======================================================== lifecycle
def readiness(survey: Survey) -> list[dict]:
    """The checklist shown before publishing -- the same rules publish() enforces."""
    questions = all_questions(survey)
    uncovered = [q for q in questions if q.responder_id is None]
    respondents = {q.responder_id for q in questions} - {None}
    reviewer, approver = survey.reviewer_id, survey.approver_id
    apart = bool(reviewer and approver and reviewer != approver and not ({reviewer, approver} & respondents))
    return [
        {"key": "questions", "label": "At least one question", "ok": bool(questions)},
        {"key": "assigned", "label": "Every question has a respondent", "ok": bool(questions) and not uncovered},
        {"key": "people", "label": "A reviewer and an approver, who aren't respondents", "ok": apart},
    ]


@transaction.atomic
def publish(survey: Survey, by) -> Survey:
    require_draft(survey)
    missing = [item["label"] for item in readiness(survey) if not item["ok"]]
    if missing:
        raise ApiError("Can't publish yet. Still needed: " + "; ".join(missing) + ".")
    survey.status = "in_progress"
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
        new_section = Section.objects.create(
            survey=copy, order=section.order, title=section.title, description=section.description, gri_standard=section.gri_standard
        )
        for q in section.questions.all():
            SurveyQuestion.objects.create(
                section=new_section, order=q.order, bank_question=q.bank_question, responder=q.responder,
                **{name: getattr(q, name) for name in QUESTION_FIELDS},
            )
    _log(copy, "created", by, f"Duplicated from “{survey.title}”")
    return copy


# ====================================================== the workflow
def _expect_live(survey):
    if survey.status != "in_progress":
        raise ApiError("This survey is not accepting responses.")


def _targets(survey, question_ids, allowed_status, owned_by=None):
    """The questions an action applies to: those asked for (all the person can
    act on when none are named), each of which must be at the right stage."""
    pool = [q for q in all_questions(survey) if owned_by is None or q.responder_id == owned_by.pk]
    if question_ids is None:
        chosen = [q for q in pool if q.status in allowed_status]
    else:
        wanted = {str(i) for i in question_ids}
        chosen = [q for q in pool if str(q.id) in wanted]
        if len(chosen) != len(wanted):
            raise ApiError("A selected question isn't one you can act on.")
        if any(q.status not in allowed_status for q in chosen):
            raise ApiError(STAGE_ERROR)
    if not chosen:
        raise ApiError("There are no questions waiting for you to act on.")
    return chosen


def _set_status(questions, status, progress=None):
    for q in questions:
        q.status = status
        if progress is not None:
            q.progress = max(q.progress, progress)
        q.save(update_fields=["status", "progress"])


def _refresh_status(survey):
    """The survey is approved once every question is; otherwise it is in progress."""
    done = not SurveyQuestion.objects.filter(section__survey=survey).exclude(status="approved").exists()
    survey.status = "approved" if done else "in_progress"
    survey.save(update_fields=["status"])


@transaction.atomic
def submit_response(survey: Survey, user, answers, question_ids=None) -> Survey:
    """A respondent submits some or all of their open questions."""
    _expect_live(survey)
    if not isinstance(answers, dict):
        raise ApiError("Answers are required.")
    mine = _targets(survey, question_ids, RESPONDER_OPEN, owned_by=user)
    cleaned = {}
    for q in mine:
        value = answers.get(str(q.id))
        validate_answer({"text": q.text, "type": q.type, "options": q.options, "required": q.required}, value)
        if value not in (None, "", []):
            cleaned[str(q.id)] = value.strip() if isinstance(value, str) else value
    ids = {str(q.id) for q in mine}
    survey.answers = {**{k: v for k, v in survey.answers.items() if k not in ids}, **cleaned}
    survey.draft_answers = {k: v for k, v in survey.draft_answers.items() if k not in ids}
    survey.save(update_fields=["answers", "draft_answers"])
    _set_status(mine, "awaiting_review", SurveyQuestion.PROGRESS_SUBMITTED)
    _log(survey, "submitted", user, snapshot=cleaned, questions=mine)
    return survey


@transaction.atomic
def save_draft(survey: Survey, user, answers) -> Survey:
    """Keep the respondent's work in progress. Required answers are not
    enforced yet (that happens on submit), but each answer given must still be
    the right shape for its question. Only the respondent's own open questions
    are saved, and other people's drafts are left alone."""
    _expect_live(survey)
    if not isinstance(answers, dict):
        raise ApiError("Answers are required.")
    mine = {str(q.id): q for q in all_questions(survey) if q.responder_id == user.pk and q.status in RESPONDER_OPEN}
    if not mine:
        raise ApiError("You have no open questions in this survey.")
    cleaned = {}
    for question_id, value in answers.items():
        q = mine.get(question_id)
        if q is None or is_empty(value):
            continue
        validate_answer({"text": q.text, "type": q.type, "options": q.options, "required": False}, value)
        cleaned[question_id] = value.strip() if isinstance(value, str) else value
    survey.draft_answers = {**{k: v for k, v in survey.draft_answers.items() if k not in mine}, **cleaned}
    survey.save(update_fields=["draft_answers"])
    return survey


def _clean_question_comments(survey, items, allowed=None):
    """Validate notes pinned to questions: [{question_id, text}, ...]. Blank
    notes are dropped; a note on a question outside this survey (or outside
    `allowed`, the questions the decision covers) is an error."""
    known = {str(q.id): q for q in (allowed if allowed is not None else all_questions(survey))}
    cleaned = {}
    for item in items or []:
        text = (item.get("text") or "").strip()
        if not text:
            continue
        question = known.get(str(item.get("question_id")))
        if question is None:
            raise ApiError("A comment refers to a question that isn't part of this decision.")
        cleaned[question.pk] = (question, text)
    return list(cleaned.values())


def _return(survey, user, comment, question_comments, audience, questions, status):
    """Send questions back. A return needs something to act on: a general
    comment, a note on a question, or both."""
    notes = _clean_question_comments(survey, question_comments, questions)
    if not (comment or "").strip() and not notes:
        raise ApiError("Add a comment, or a note on a question, explaining what to fix.")
    _set_status(questions, status)
    event = _log(survey, "returned", user, comment, audience, questions=questions)
    QuestionComment.objects.bulk_create(
        [QuestionComment(event=event, question=q, author=user, text=text) for q, text in notes]
    )


def _advance(survey, user, action, comment, question_comments, questions, status, progress):
    """Move questions forward. Notes may ride along, so a reviewer can pass a
    question and still leave a remark for the approver."""
    notes = _clean_question_comments(survey, question_comments, questions)
    _set_status(questions, status, progress)
    event = _log(survey, action, user, comment, questions=questions)
    QuestionComment.objects.bulk_create(
        [QuestionComment(event=event, question=q, author=user, text=text) for q, text in notes]
    )


@transaction.atomic
def review(survey: Survey, user, decision, comment, question_comments=None, audience="responder", question_ids=None) -> Survey:
    if survey.reviewer_id != user.pk:
        raise ApiError("Only the assigned reviewer can review.")
    _expect_live(survey)
    if decision not in ("pass", "return"):
        raise ApiError("Decision must be 'pass' or 'return'.")
    questions = _targets(survey, question_ids, ("awaiting_review",))
    if decision == "return":
        # The reviewer can only send questions back down the chain, to the respondent.
        _return(survey, user, comment, question_comments, "responder", questions, "returned")
    else:
        _advance(survey, user, "reviewed", comment, question_comments, questions, "awaiting_approval", SurveyQuestion.PROGRESS_REVIEWED)
    return survey


@transaction.atomic
def approve(survey: Survey, user, decision, comment, question_comments=None, audience="responder", question_ids=None) -> Survey:
    if survey.approver_id != user.pk:
        raise ApiError("Only the assigned approver can approve.")
    _expect_live(survey)
    if decision not in ("approve", "return"):
        raise ApiError("Decision must be 'approve' or 'return'.")
    questions = _targets(survey, question_ids, ("awaiting_approval",))
    if decision == "return":
        if audience not in RETURN_AUDIENCES:
            raise ApiError("Choose who to return it to: the respondent, the reviewer or both.")
        _return(survey, user, comment, question_comments, audience, questions, "awaiting_review" if audience == "reviewer" else "returned")
    else:
        _advance(survey, user, "approved", comment, question_comments, questions, "approved", None)
    _refresh_status(survey)
    return survey
