from django.db.models import Count
from rest_framework import viewsets

from apps.core.exceptions import ApiError
from apps.core.permissions import IsAdminOrReadOnly
from apps.core.viewset_mixins import TenantScopedMixin
from apps.question_bank.models import BankCategory, Question
from apps.question_bank.serializers import BankCategorySerializer, BankQuestionSerializer


class BankCategoryViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrReadOnly]
    serializer_class = BankCategorySerializer
    pagination_class = None

    def get_queryset(self):
        return BankCategory.objects.annotate(question_count=Count("questions")).order_by("display_order", "label")

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
        return Question.objects.select_related("category")
