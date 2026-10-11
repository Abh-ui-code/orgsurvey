from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsAdminOrReadOnly
from apps.core.tenant_context import current_tenant
from apps.tenants.models import Tenant

DEFAULT_DUE_DAYS = 14


def settings_payload(tenant: Tenant) -> dict:
    return {
        "org_name": tenant.name,
        "default_due_days": int(tenant.settings.get("default_due_days", DEFAULT_DUE_DAYS)),
    }


class WorkspaceLookupView(APIView):
    """Public: does a workspace with this subdomain exist? Used by the
    "find your workspace" screen on the bare host."""

    permission_classes = [AllowAny]
    authentication_classes: list = []

    def get(self, request):
        sub = request.query_params.get("subdomain", "").strip().lower()
        tenant = Tenant.objects.filter(subdomain=sub, is_active=True, is_ready=True).first()
        if tenant is None:
            return Response({"detail": "No workspace with that name."}, status=404)
        return Response({"name": tenant.name, "subdomain": tenant.subdomain})


class WorkspaceInfoView(APIView):
    """Public: name of the workspace on this subdomain, so the login page can brand itself."""

    permission_classes = [AllowAny]
    authentication_classes: list = []

    def get(self, request):
        tenant = current_tenant(request)
        return Response({"name": tenant.name, "subdomain": tenant.subdomain})


class SettingsSerializer(serializers.Serializer):
    org_name = serializers.CharField(max_length=255)
    default_due_days = serializers.IntegerField(min_value=1, max_value=365)


class WorkspaceSettingsView(APIView):
    """Workspace-level options. Anyone in the workspace reads; admins write."""

    permission_classes = [IsAdminOrReadOnly]

    def get(self, request):
        return Response(settings_payload(current_tenant(request)))

    def put(self, request):
        serializer = SettingsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tenant = current_tenant(request)
        tenant.name = serializer.validated_data["org_name"].strip()
        tenant.settings = {**tenant.settings, "default_due_days": serializer.validated_data["default_due_days"]}
        tenant.save(update_fields=["name", "settings"])
        return Response(settings_payload(tenant))
