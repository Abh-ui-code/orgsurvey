from django.db import connection
from rest_framework.permissions import SAFE_METHODS, BasePermission


def member_for(request):
    """The caller's Member row in the current tenant schema, or None. Cached
    on the request so a view and its permission class don't query twice."""
    if not hasattr(request, "_member"):
        from apps.organisation.models import Member

        request._member = None
        user = request.user
        if user and user.is_authenticated:
            request._member = Member.objects.filter(user=user, is_active=True).select_related("unit").first()
    return request._member


class IsTenantMember(BasePermission):
    """
    Authenticated, and an active Member of *this* tenant. Two independent
    checks, both required: the token must have been issued for this tenant's
    schema (a token from abc is useless on xyz even if the same person is a
    member of both), and a Member row must exist in this schema.
    """

    message = "You are not a member of this workspace."

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        token_schema = getattr(request.auth, "get", lambda *_: None)("tenant_schema")
        if token_schema != connection.schema_name:
            return False
        return member_for(request) is not None


class IsTenantAdmin(IsTenantMember):
    message = "Only administrators can do this."

    def has_permission(self, request, view):
        return super().has_permission(request, view) and member_for(request).role == "admin"


class IsAdminOrReadOnly(IsTenantMember):
    """Everyone in the workspace reads; only administrators write."""

    message = "Only administrators can do this."

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        return request.method in SAFE_METHODS or member_for(request).role == "admin"
