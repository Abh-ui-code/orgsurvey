from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils.text import slugify
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsTenantAdmin, IsTenantMember, member_for
from apps.reports import audit, services
from apps.surveys.models import Survey


class DashboardView(APIView):
    """Headline counts and per-block progress, scoped to what the caller may see."""

    permission_classes = [IsTenantMember]

    def get(self, request):
        return Response(services.dashboard(request.user, member_for(request)))


class SummaryView(APIView):
    """Workspace-wide report figures. Administrators only."""

    permission_classes = [IsTenantAdmin]

    def get(self, request):
        return Response(services.summary())


class SurveyAuditView(APIView):
    """One survey's whole story as an Excel workbook. Administrators only."""

    permission_classes = [IsTenantAdmin]

    def get(self, request, pk):
        survey = get_object_or_404(
            Survey.objects.select_related("category", "target_unit", "responder", "reviewer", "approver", "created_by"), pk=pk
        )
        response = HttpResponse(
            audit.build_workbook(survey),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = f'attachment; filename="{slugify(survey.title) or "survey"}-audit-trail.xlsx"'
        return response
