"""Routes available inside a tenant schema (abc.localhost:8000 and so on)."""
from django.http import JsonResponse
from django.urls import include, path

from apps.tenants.views import WorkspaceInfoView, WorkspaceSettingsView


def health(request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("api/", health),
    path("api/workspace/", WorkspaceInfoView.as_view(), name="workspace-info"),
    path("api/settings/workspace/", WorkspaceSettingsView.as_view(), name="workspace-settings"),
    path("api/auth/", include("apps.authentication.urls")),
    path("api/reports/", include("apps.reports.urls")),
    path("api/", include("apps.organisation.urls")),
    path("api/", include("apps.question_bank.urls")),
    path("api/", include("apps.surveys.urls")),
]
