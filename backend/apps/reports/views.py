from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsTenantAdmin, IsTenantMember, member_for
from apps.reports import services


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
