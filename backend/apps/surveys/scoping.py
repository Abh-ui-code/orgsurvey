"""Who may see and act on which surveys -- kept in one place so the list, the
detail, the dashboard and the tasks inbox can never disagree."""
from django.db.models import Q

from apps.surveys.models import Survey


def scope_surveys(queryset, user, member):
    """Administrators see every survey. Everyone else sees only the surveys
    they are one of the three people on, and never a draft."""
    if member is not None and member.role == "admin":
        return queryset
    involved = Q(responder=user) | Q(reviewer=user) | Q(approver=user)
    return queryset.filter(involved).exclude(status="draft")


def waiting_on(user) -> Q:
    """Surveys currently waiting for this person to act."""
    return (
        Q(responder=user, status__in=("awaiting_response", "returned"))
        | Q(reviewer=user, status="awaiting_review")
        | Q(approver=user, status="awaiting_approval")
    )


def task_for(survey: Survey, user):
    """What `user` must do on `survey` right now, or None."""
    if survey.responder_id == user.pk and survey.status in ("awaiting_response", "returned"):
        return {"role": "responder", "action": "Revise and resubmit" if survey.status == "returned" else "Respond"}
    if survey.reviewer_id == user.pk and survey.status == "awaiting_review":
        return {"role": "reviewer", "action": "Review"}
    if survey.approver_id == user.pk and survey.status == "awaiting_approval":
        return {"role": "approver", "action": "Approve"}
    return None
