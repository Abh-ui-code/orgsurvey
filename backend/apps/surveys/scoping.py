"""Who may see and act on which surveys and questions -- kept in one place so
the list, the detail, the dashboard and the tasks inbox can never disagree.

Visibility is per question: a respondent sees the questions assigned to them;
the reviewer sees a question once it has been submitted; the approver once it
has passed review; administrators see everything."""
from django.db.models import Q

from apps.surveys.models import Survey, SurveyQuestion

RESPONDER_OPEN = ("awaiting_response", "returned")


def _surveys_with_questions(**filters):
    return SurveyQuestion.objects.filter(**filters).values("section__survey")


def scope_surveys(queryset, user, member):
    """Administrators see every survey. Everyone else sees only the surveys
    they review, approve or have a question in, and never a draft."""
    if member is not None and member.role == "admin":
        return queryset
    involved = Q(reviewer=user) | Q(approver=user) | Q(pk__in=_surveys_with_questions(responder=user))
    return queryset.filter(involved).exclude(status="draft")


def waiting_on(user) -> Q:
    """Surveys with at least one question waiting for this person to act."""
    return (
        Q(pk__in=_surveys_with_questions(responder=user, status__in=RESPONDER_OPEN))
        | Q(reviewer=user, pk__in=_surveys_with_questions(status="awaiting_review"))
        | Q(approver=user, pk__in=_surveys_with_questions(status="awaiting_approval"))
    )


def survey_questions(survey) -> list:
    """All of a survey's questions in order (uses prefetched sections when present)."""
    return [q for section in survey.sections.all() for q in section.questions.all()]


def can_see(question, survey, user, is_admin: bool) -> bool:
    if is_admin or question.responder_id == user.pk:
        return True
    if survey.reviewer_id == user.pk and question.progress >= SurveyQuestion.PROGRESS_SUBMITTED:
        return True
    return survey.approver_id == user.pk and question.progress >= SurveyQuestion.PROGRESS_REVIEWED


def visible_questions(survey, user, is_admin: bool) -> list:
    return [q for q in survey_questions(survey) if can_see(q, survey, user, is_admin)]


def questions_for(survey, user, role: str) -> list:
    """The questions `user` can act on right now in `role`."""
    wanted = {"responder": RESPONDER_OPEN, "reviewer": ("awaiting_review",), "approver": ("awaiting_approval",)}[role]
    if role == "responder":
        return [q for q in survey_questions(survey) if q.responder_id == user.pk and q.status in wanted]
    owner = survey.reviewer_id if role == "reviewer" else survey.approver_id
    if owner != user.pk:
        return []
    return [q for q in survey_questions(survey) if q.status in wanted]


def task_for(survey: Survey, user):
    """What `user` must do on `survey` right now, or None."""
    if survey.status != "in_progress":
        return None
    mine = questions_for(survey, user, "responder")
    if mine:
        revising = any(q.status == "returned" for q in mine)
        return {"role": "responder", "action": "Revise and resubmit" if revising else "Respond", "count": len(mine)}
    for role, action in (("reviewer", "Review"), ("approver", "Approve")):
        found = questions_for(survey, user, role)
        if found:
            return {"role": role, "action": action, "count": len(found)}
    return None


def stage_counts(questions) -> dict:
    counts = {status: 0 for status, _ in SurveyQuestion.STATUSES}
    for q in questions:
        counts[q.status] += 1
    counts["total"] = len(questions)
    return counts
