from django.contrib.auth import get_user_model
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import serializers

from apps.core.serializers import IdField, PersonSerializer, QuestionFieldsSerializer, UnitRefSerializer
from apps.organisation.models import OrgUnit
from apps.surveys import services
from apps.surveys.models import QuestionComment, Section, Survey, SurveyCategory, SurveyEvent, SurveyQuestion
from apps.surveys.scoping import task_for

User = get_user_model()


# ============================================================ categories
class SurveyCategorySerializer(serializers.ModelSerializer):
    survey_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = SurveyCategory
        fields = ["id", "code", "label", "description", "color", "display_order", "is_active", "survey_count"]
        read_only_fields = ["code", "display_order"]

    def validate_label(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Category name is required.")
        clash = SurveyCategory.objects.filter(label__iexact=value)
        if self.instance is not None:
            clash = clash.exclude(pk=self.instance.pk)
        if clash.exists():
            raise serializers.ValidationError("A category with that name already exists.")
        return value

    def validate_color(self, value):
        if value not in SurveyCategory.COLORS:
            raise serializers.ValidationError("Unknown colour.")
        return value

    def create(self, validated):
        base = slugify(validated["label"]) or "category"
        code, n = base, 2
        while SurveyCategory.objects.filter(code=code).exists():
            code, n = f"{base}-{n}", n + 1
        validated.update(code=code, display_order=SurveyCategory.objects.count() + 1)
        return super().create(validated)


class CategoryRefSerializer(serializers.ModelSerializer):
    class Meta:
        model = SurveyCategory
        fields = ["id", "label", "color"]
        read_only_fields = fields


# ============================================================== builder
class SurveyQuestionSerializer(QuestionFieldsSerializer):
    bank_question_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = SurveyQuestion
        fields = ["id", "order", "text", "type", "options", "hint", "required", "bank_question_id"]
        read_only_fields = ["order"]


class SectionSerializer(serializers.ModelSerializer):
    questions = SurveyQuestionSerializer(many=True, read_only=True)

    class Meta:
        model = Section
        fields = ["id", "order", "title", "description", "questions"]
        read_only_fields = ["order"]

    def validate_title(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Give the section a title.")
        return value


class QuestionCommentSerializer(serializers.ModelSerializer):
    question_id = serializers.UUIDField(read_only=True)
    by = PersonSerializer(source="author", read_only=True)
    at = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = QuestionComment
        fields = ["id", "question_id", "by", "at", "text"]
        read_only_fields = fields


class SurveyEventSerializer(serializers.ModelSerializer):
    by = PersonSerializer(read_only=True)
    at = serializers.DateTimeField(source="created_at", read_only=True)
    question_comments = QuestionCommentSerializer(many=True, read_only=True)

    class Meta:
        model = SurveyEvent
        fields = ["id", "action", "by", "at", "comment", "audience", "question_comments"]
        read_only_fields = fields


# ============================================================== surveys
class SurveyListSerializer(serializers.ModelSerializer):
    category = CategoryRefSerializer(read_only=True)
    target_unit = UnitRefSerializer(read_only=True)
    responder = PersonSerializer(read_only=True)
    reviewer = PersonSerializer(read_only=True)
    approver = PersonSerializer(read_only=True)
    question_count = serializers.IntegerField(read_only=True, default=0)
    my_task = serializers.SerializerMethodField()
    waiting_on = serializers.SerializerMethodField()
    stage_since = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()

    class Meta:
        model = Survey
        fields = [
            "id", "title", "description", "status", "category", "target_unit",
            "responder", "reviewer", "approver", "due_date", "is_overdue", "question_count",
            "my_task", "waiting_on", "stage_since", "published_at", "created_at",
        ]
        read_only_fields = fields

    def get_waiting_on(self, survey):
        """Who is holding the survey up right now: the person it is with, and in which role."""
        holder = {
            "awaiting_response": ("responder", survey.responder),
            "returned": ("responder", survey.responder),
            "awaiting_review": ("reviewer", survey.reviewer),
            "awaiting_approval": ("approver", survey.approver),
        }.get(survey.status)
        if holder is None or holder[1] is None:
            return None
        return {"role": holder[0], "person": PersonSerializer(holder[1]).data}

    def get_stage_since(self, survey):
        """When the survey last changed hands, so "waiting 6 days" can be shown."""
        stamp = getattr(survey, "last_activity", None) or survey.created_at
        return stamp.isoformat()

    def get_is_overdue(self, survey):
        return bool(survey.due_date and survey.status in Survey.LIVE and survey.due_date < timezone.localdate())

    def get_my_task(self, survey):
        """What the signed-in person has to do on this survey now, if anything."""
        request = self.context.get("request")
        return task_for(survey, request.user) if request else None


class SurveyDetailSerializer(SurveyListSerializer):
    sections = SectionSerializer(many=True, read_only=True)
    history = SurveyEventSerializer(source="events", many=True, read_only=True)
    readiness = serializers.SerializerMethodField()
    created_by = PersonSerializer(read_only=True)

    class Meta(SurveyListSerializer.Meta):
        fields = [
            *SurveyListSerializer.Meta.fields,
            "instructions", "sections", "answers", "draft_answers", "readiness", "history", "created_by",
        ]
        read_only_fields = fields

    def to_representation(self, survey):
        data = super().to_representation(survey)
        # Work in progress belongs to the responder alone.
        request = self.context.get("request")
        if request is None or survey.responder_id != request.user.pk:
            data["draft_answers"] = {}
        return data

    def get_readiness(self, survey):
        """What is still missing before a draft can publish; empty once published."""
        return services.readiness(survey) if survey.status == "draft" else []


class SurveyCreateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    category_id = IdField(source="category", queryset=SurveyCategory.objects.all())
    target_unit_id = IdField(source="target_unit", queryset=OrgUnit.objects.all())
    description = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_title(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Give the survey a title.")
        return value


class SurveyUpdateSerializer(serializers.Serializer):
    """Every field optional: a PATCH sends only what changed. Which of them are
    allowed depends on the survey's stage -- services.update_survey decides."""

    title = serializers.CharField(max_length=255, required=False)
    category_id = IdField(source="category", queryset=SurveyCategory.objects.all(), required=False)
    description = serializers.CharField(required=False, allow_blank=True)
    instructions = serializers.CharField(required=False, allow_blank=True)
    target_unit_id = IdField(source="target_unit", queryset=OrgUnit.objects.all(), required=False)
    due_date = serializers.DateField(required=False, allow_null=True)
    responder_id = IdField(source="responder", queryset=User.objects.all(), required=False, allow_null=True)
    reviewer_id = IdField(source="reviewer", queryset=User.objects.all(), required=False, allow_null=True)
    approver_id = IdField(source="approver", queryset=User.objects.all(), required=False, allow_null=True)


class SubmitSerializer(serializers.Serializer):
    answers = serializers.DictField()


class DraftSerializer(serializers.Serializer):
    answers = serializers.DictField()


class QuestionNoteSerializer(serializers.Serializer):
    question_id = serializers.UUIDField()
    text = serializers.CharField(allow_blank=True)


class DecisionSerializer(serializers.Serializer):
    decision = serializers.CharField()
    comment = serializers.CharField(required=False, allow_blank=True, default="")
    question_comments = QuestionNoteSerializer(many=True, required=False, default=list)
    # Who a return goes to. The reviewer's is always the responder.
    audience = serializers.ChoiceField(choices=["responder", "reviewer", "both"], required=False, default="responder")


class CloseSerializer(serializers.Serializer):
    comment = serializers.CharField(required=False, allow_blank=True, default="")


class MoveSerializer(serializers.Serializer):
    direction = serializers.ChoiceField(choices=["up", "down"])
