"""
Numbers for the dashboard and the reports page, computed in the database so
the web app never has to download every survey to count them. Everything
goes through `scope_surveys`, so a member's figures only ever cover the
surveys they are part of.
"""
from django.db.models import Count, Q
from django.utils import timezone

from apps.organisation.models import OrgUnit
from apps.surveys.models import Survey, SurveyCategory
from apps.surveys.scoping import scope_surveys, waiting_on

IN_PROGRESS = ("awaiting_response", "awaiting_review", "awaiting_approval")
REPORT_STATUSES = ("awaiting_response", "awaiting_review", "awaiting_approval", "returned", "approved", "closed")


def _by_unit(surveys) -> list[dict]:
    """Survey counts per org block, each block including everything beneath it
    (a survey aimed at Engineering also counts for Technology and the whole organisation)."""
    own = {
        row["target_unit"]: row
        for row in surveys.values("target_unit").annotate(
            total=Count("id"),
            approved=Count("id", filter=Q(status="approved")),
            returned=Count("id", filter=Q(status="returned")),
        )
    }
    units = list(OrgUnit.objects.all())
    children: dict = {}
    for unit in units:
        children.setdefault(unit.parent_id, []).append(unit.id)

    def rolled(unit_id):
        row = own.get(unit_id, {})
        total, approved, returned = row.get("total", 0), row.get("approved", 0), row.get("returned", 0)
        for child in children.get(unit_id, []):
            t, a, r = rolled(child)
            total, approved, returned = total + t, approved + a, returned + r
        return total, approved, returned

    out = []
    for unit in units:
        total, approved, returned = rolled(unit.id)
        if total:
            out.append({"unit_id": unit.id, "name": unit.name, "total": total, "approved": approved, "returned": returned})
    return out


def dashboard(user, member) -> dict:
    visible = scope_surveys(Survey.objects.all(), user, member)
    published = visible.exclude(status="draft")
    is_admin = member is not None and member.role == "admin"
    return {
        "counts": {
            "waiting_on_you": published.filter(waiting_on(user)).count(),
            "surveys": published.count(),
            "in_progress": published.filter(status__in=IN_PROGRESS).count(),
            "returned": published.filter(status="returned").count(),
            "approved": published.filter(status="approved").count(),
            "overdue": published.filter(due_date__lt=timezone.localdate(), status__in=Survey.LIVE).count(),
            "drafts": visible.filter(status="draft").count() if is_admin else 0,
        },
        "by_unit": _by_unit(published),
    }


def summary() -> dict:
    published = Survey.objects.exclude(status="draft")
    status_counts = dict(published.values_list("status").annotate(n=Count("id")))
    by_category = []
    for category in SurveyCategory.objects.all():
        surveys = published.filter(category=category)
        total = surveys.count()
        if total:
            by_category.append({
                "category_id": category.id,
                "label": category.label,
                "total": total,
                "in_progress": surveys.filter(status__in=IN_PROGRESS).count(),
                "approved": surveys.filter(status="approved").count(),
            })
    return {
        "by_status": [{"status": s, "count": status_counts.get(s, 0)} for s in REPORT_STATUSES],
        "by_unit": _by_unit(published),
        "by_category": by_category,
    }
