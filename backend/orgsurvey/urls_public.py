"""Routes on the public schema -- platform hosts like localhost:8000, reachable before a tenant is known."""
from django.http import JsonResponse
from django.urls import path

from apps.tenants.views import WorkspaceLookupView


def health(request):
    return JsonResponse({"status": "ok", "schema": "public"})


urlpatterns = [
    path("api/", health),
    path("api/workspaces/lookup/", WorkspaceLookupView.as_view(), name="workspace-lookup"),
]
