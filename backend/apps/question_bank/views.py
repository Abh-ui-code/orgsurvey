from django.db.models import Count
from rest_framework import viewsets

from apps.core.exceptions import ApiError
from apps.core.permissions import IsAdminOrReadOnly
from apps.core.viewset_mixins import TenantScopedMixin
from apps.question_bank.models import BankCategory, GriStandard, Question
from apps.question_bank.serializers import (
    BankCategorySerializer,
    BankQuestionSerializer,
    GriStandardDetailSerializer,
    GriStandardSerializer,
)


class BankCategoryViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrReadOnly]
    serializer_class = BankCategorySerializer
    pagination_class = None

    def get_queryset(self):
        return (
            BankCategory.objects.filter(is_system=False)
            .annotate(question_count=Count("questions"))
            .order_by("display_order", "label")
        )

    def perform_destroy(self, category):
        if category.questions.exists():
            raise ApiError("This category still has questions. Move or delete them first.")
        category.delete()


class BankQuestionViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    permission_classes = [IsAdminOrReadOnly]
    serializer_class = BankQuestionSerializer
    filterset_fields = ["category", "type"]
    search_fields = ["text", "hint"]
    ordering_fields = ["created_at", "text"]
    ordering = ["created_at"]

    def get_queryset(self):
        # GRI questions belong to their standard and are only ever added as a whole section.
        return Question.objects.select_related("category").filter(gri_standard__isnull=True)


class GriStandardViewSet(viewsets.ReadOnlyModelViewSet):
    """The GRI Standards: a summary, the PDF and the questions in it."""

    pagination_class = None
    filterset_fields = ["series"]

    def get_serializer_class(self):
        return GriStandardDetailSerializer if self.action == "retrieve" else GriStandardSerializer

    def get_queryset(self):
        return GriStandard.objects.annotate(question_count=Count("questions")).order_by("display_order", "code")
