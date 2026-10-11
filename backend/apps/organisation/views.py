from django.db.models import Count, Q
from rest_framework import viewsets

from apps.core.exceptions import ApiError
from apps.core.permissions import IsAdminOrReadOnly
from apps.organisation.models import Member, OrgUnit
from apps.organisation.serializers import MemberSerializer, UnitSerializer


class UnitViewSet(viewsets.ModelViewSet):
    """The org hierarchy. Small and always read whole (it is drawn as a tree),
    so it is not paginated."""

    permission_classes = [IsAdminOrReadOnly]
    serializer_class = UnitSerializer
    pagination_class = None
    filterset_fields = ["parent", "kind"]

    def get_queryset(self):
        return (
            OrgUnit.objects.select_related("head")
            .annotate(member_count=Count("members", filter=Q(members__is_active=True)))
            .order_by("name")
        )

    def perform_destroy(self, unit):
        from apps.surveys.models import Survey

        if unit.parent_id is None:
            raise ApiError("The root block cannot be deleted.")
        if unit.children.exists():
            raise ApiError("Move or delete the child blocks first.")
        if Survey.objects.filter(target_unit=unit).exists():
            raise ApiError("Surveys are aimed at this block, so it cannot be deleted.")
        Member.objects.filter(unit=unit).update(unit=unit.parent)  # people move up a level
        unit.delete()


class MemberViewSet(viewsets.ModelViewSet):
    """People in this workspace. Addressed by *user* id. There is no delete:
    someone who leaves is deactivated, so the history that names them stays readable."""

    permission_classes = [IsAdminOrReadOnly]
    serializer_class = MemberSerializer
    lookup_field = "user_id"
    lookup_url_kwarg = "pk"
    lookup_value_regex = "[0-9a-fA-F-]{36}"
    http_method_names = ["get", "post", "put", "patch", "head", "options"]
    filterset_fields = ["role", "unit", "is_active"]
    search_fields = ["user__full_name", "user__email", "title"]
    ordering_fields = ["user__full_name", "role", "created_at"]
    ordering = ["user__full_name"]

    def get_queryset(self):
        return Member.objects.select_related("user", "unit")
