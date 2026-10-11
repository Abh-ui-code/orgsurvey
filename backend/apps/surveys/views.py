import django_filters
from django.db.models import Count, Max
from django.utils import timezone
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.exceptions import ApiError
from apps.core.permissions import IsAdminOrReadOnly, IsTenantAdmin, IsTenantMember, member_for
from apps.core.viewset_mixins import TenantScopedMixin
from apps.question_bank.models import Question as BankQuestion
from apps.surveys import services
from apps.surveys.models import Section, Survey, SurveyCategory, SurveyQuestion
from apps.surveys.scoping import scope_surveys, waiting_on
from apps.surveys.serializers import (
    CloseSerializer,
    DecisionSerializer,
    DraftSerializer,
    MoveSerializer,
    SectionSerializer,
    SubmitSerializer,
    SurveyCategorySerializer,
    SurveyCreateSerializer,
    SurveyDetailSerializer,
    SurveyListSerializer,
    SurveyQuestionSerializer,
    SurveyUpdateSerializer,
)


class SurveyCategoryViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrReadOnly]
    serializer_class = SurveyCategorySerializer
    pagination_class = None

    def get_queryset(self):
        return SurveyCategory.objects.annotate(survey_count=Count("surveys")).order_by("display_order", "label")

    def perform_destroy(self, category):
        if category.surveys.exists():
            raise ApiError("Surveys use this category. Switch it off instead of deleting it.")
        category.delete()


class SurveyFilter(django_filters.FilterSet):
    """`?category=&status=&target_unit=`, plus two convenience filters:
    `?overdue=true` (published, still moving, past its due date) and
    `?in_progress=true` (awaiting a response, review or approval)."""

    overdue = django_filters.BooleanFilter(method="filter_overdue")
    in_progress = django_filters.BooleanFilter(method="filter_in_progress")

    class Meta:
        model = Survey
        fields = ["category", "status", "target_unit"]

    def filter_overdue(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.filter(due_date__lt=timezone.localdate(), status__in=Survey.LIVE)


    def filter_in_progress(self, queryset, name, value):
        """Waiting on someone: any of the three stages, not returned, approved or closed."""
        if not value:
            return queryset
        return queryset.filter(status__in=("awaiting_response", "awaiting_review", "awaiting_approval"))


class SurveyViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    """
    Surveys, from draft to approved. Reads are scoped (see scoping.py);
    writes and publish/close/duplicate are administrator-only; the three
    workflow actions (submit, review, approve) belong to the person assigned.
    """

    permission_classes = [IsAdminOrReadOnly]
    filterset_class = SurveyFilter
    search_fields = ["title", "description"]
    ordering_fields = ["created_at", "title", "status", "due_date"]
    ordering = ["-created_at"]

    DETAIL_ACTIONS = {"retrieve", "create", "update", "partial_update", "publish", "close", "duplicate", "submit", "save_draft", "review", "approve"}

    def get_queryset(self):
        queryset = (
            Survey.objects.select_related("category", "target_unit", "responder", "reviewer", "approver", "created_by")
            .annotate(question_count=Count("sections__questions", distinct=True), last_activity=Max("events__created_at"))
        )
        if self.action in self.DETAIL_ACTIONS:
            queryset = queryset.prefetch_related("sections__questions", "events__by")
        return scope_surveys(queryset, self.request.user, member_for(self.request))

    def get_serializer_class(self):
        if self.action in ("list", "tasks"):
            return SurveyListSerializer
        if self.action == "create":
            return SurveyCreateSerializer
        if self.action in ("update", "partial_update"):
            return SurveyUpdateSerializer
        return SurveyDetailSerializer

    def _detail(self, survey, http_status=status.HTTP_200_OK):
        """Re-read the survey so the response reflects exactly what is stored."""
        fresh = self.get_queryset().get(pk=survey.pk)
        return Response(SurveyDetailSerializer(fresh, context=self.get_serializer_context()).data, status=http_status)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        survey = services.create_draft(**serializer.validated_data, creator=request.user)
        return self._detail(survey, status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        survey = self.get_object()
        serializer = self.get_serializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        services.update_survey(survey, **serializer.validated_data)
        return self._detail(survey)

    # ---------------------------------------------------- lifecycle (admin)
    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        survey = self.get_object()
        services.publish(survey, request.user)
        return self._detail(survey)

    @action(detail=True, methods=["post"])
    def close(self, request, pk=None):
        survey = self.get_object()
        body = CloseSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        services.close(survey, request.user, body.validated_data["comment"])
        return self._detail(survey)

    @action(detail=True, methods=["post"])
    def duplicate(self, request, pk=None):
        copy = services.duplicate(self.get_object(), request.user)
        return self._detail(copy, status.HTTP_201_CREATED)

    # ------------------------------------------- workflow (assigned people)
    @action(detail=True, methods=["post"], permission_classes=[IsTenantMember])
    def submit(self, request, pk=None):
        survey = self.get_object()
        body = SubmitSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        services.submit_response(survey, request.user, body.validated_data["answers"])
        return self._detail(survey)

    @action(detail=True, methods=["post"], url_path="save-draft", permission_classes=[IsTenantMember])
    def save_draft(self, request, pk=None):
        """Keep the responder's work in progress without submitting it."""
        survey = self.get_object()
        body = DraftSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        services.save_draft(survey, request.user, body.validated_data["answers"])
        return self._detail(survey)

    @action(detail=True, methods=["post"], permission_classes=[IsTenantMember])
    def review(self, request, pk=None):
        survey = self.get_object()
        body = DecisionSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        services.review(survey, request.user, **body.validated_data)
        return self._detail(survey)

    @action(detail=True, methods=["post"], permission_classes=[IsTenantMember])
    def approve(self, request, pk=None):
        survey = self.get_object()
        body = DecisionSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        services.approve(survey, request.user, **body.validated_data)
        return self._detail(survey)

    @action(detail=False, methods=["get"], permission_classes=[IsTenantMember])
    def tasks(self, request):
        """The surveys waiting on the signed-in person, soonest due first."""
        queryset = self.filter_queryset(self.get_queryset()).filter(waiting_on(request.user))
        queryset = queryset.order_by("due_date", "-created_at")
        page = self.paginate_queryset(queryset)
        serializer = self.get_serializer(page, many=True)
        return self.get_paginated_response(serializer.data)


# ====================================================== builder (admin only)
class SurveySectionViewSet(viewsets.ModelViewSet):
    """Sections of one survey: /surveys/{survey_pk}/sections/."""

    permission_classes = [IsTenantAdmin]
    serializer_class = SectionSerializer
    pagination_class = None

    def get_queryset(self):
        return Section.objects.filter(survey_id=self.kwargs["survey_pk"]).prefetch_related("questions")

    def create(self, request, *args, **kwargs):
        survey = get_object_or_404(Survey, pk=self.kwargs["survey_pk"])
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        section = services.add_section(survey, **serializer.validated_data)
        return Response(self.get_serializer(section).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        section = self.get_object()
        serializer = self.get_serializer(section, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        services.update_section(section, **serializer.validated_data)
        return Response(self.get_serializer(self.get_object()).data)

    def perform_destroy(self, section):
        services.delete_section(section)

    @action(detail=True, methods=["post"])
    def move(self, request, **kwargs):
        body = MoveSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        services.move_section(self.get_object(), body.validated_data["direction"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class SurveyQuestionViewSet(viewsets.ModelViewSet):
    """Questions of one section: /surveys/{survey_pk}/sections/{section_pk}/questions/."""

    permission_classes = [IsTenantAdmin]
    serializer_class = SurveyQuestionSerializer
    pagination_class = None

    def get_queryset(self):
        return SurveyQuestion.objects.filter(
            section_id=self.kwargs["section_pk"], section__survey_id=self.kwargs["survey_pk"]
        )

    def create(self, request, *args, **kwargs):
        section = get_object_or_404(Section, pk=self.kwargs["section_pk"], survey_id=self.kwargs["survey_pk"])
        bank_id = request.data.get("bank_question_id")
        if bank_id:
            bank = get_object_or_404(BankQuestion, pk=bank_id)
            question = services.add_question_from_bank(section, bank)
        else:
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            question = services.add_question(section, **serializer.validated_data)
        return Response(self.get_serializer(question).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        question = self.get_object()
        serializer = self.get_serializer(question, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        services.update_question(question, **serializer.validated_data)
        return Response(self.get_serializer(self.get_object()).data)

    def perform_destroy(self, question):
        services.delete_question(question)

    @action(detail=True, methods=["post"])
    def move(self, request, **kwargs):
        body = MoveSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        services.move_question(self.get_object(), body.validated_data["direction"])
        return Response(status=status.HTTP_204_NO_CONTENT)
