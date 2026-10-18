from django.contrib.auth import get_user_model
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import serializers

from apps.core.permissions import member_for
from apps.core.serializers import IdField, PersonSerializer, QuestionFieldsSerializer, UnitRefSerializer
from apps.organisation.models import OrgUnit
from apps.surveys import services
from apps.surveys.models import QuestionComment, Section, Survey, SurveyCategory, SurveyEvent, SurveyQuestion
from apps.surveys.scoping import can_see, stage_counts, survey_questions, task_for, visible_questions

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
    responder = PersonSerializer(read_only=True)
    responder_id = IdField(source="responder", queryset=User.objects.all(), required=False, allow_null=True, write_only=True)

    class Meta:
        model = SurveyQuestion
        fields = [
            "id", "order", "text", "type", "options", "hint", "required", "bank_question_id",
            "responder", "responder_id", "status", "progress",
        ]
        read_only_fields = ["order", "status", "progress"]


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

    question_ids = serializers.SerializerMethodField()

    class Meta:
        model = SurveyEvent
        fields = ["id", "action", "by", "at", "comment", "audience", "snapshot", "question_comments", "question_ids"]
        read_only_fields = fields

    def get_question_ids(self, event):
        return sorted(str(q.pk) for q in event.questions.all())


# ============================================================== surveys
class SurveyListSerializer(serializers.ModelSerializer):
    category = CategoryRefSerializer(read_only=True)
    target_unit = UnitRefSerializer(read_only=True)
    responder = PersonSerializer(read_only=True)
    reviewer = PersonSerializer(read_only=True)
    approver = PersonSerializer(read_only=True)
    question_count = serializers.IntegerField(read_only=True, default=0)
    return_count = serializers.IntegerField(read_only=True, default=0)
    submission_count = serializers.IntegerField(read_only=True, default=0)
    my_task = serializers.SerializerMethodField()
    waiting_on = serializers.SerializerMethodField()
    question_stats = serializers.SerializerMethodField()
    my_question_count = serializers.SerializerMethodField()
    stage_since = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()

    class Meta:
        model = Survey
        fields = [
            "id", "title", "description", "status", "category", "target_unit",
            "responder", "reviewer", "approver", "due_date", "is_overdue", "question_count",
            "return_count", "submission_count", "my_task", "waiting_on", "question_stats", "my_question_count", "stage_since", "published_at", "created_at",
        ]
        read_only_fields = fields

    def _viewer(self):
        request = self.context.get("request")
        member = member_for(request) if request else None
        return (request.user if request else None), bool(member is not None and member.role == "admin")

    def get_question_stats(self, survey):
        """How many questions are at each stage, among those the viewer can see."""
        user, is_admin = self._viewer()
        questions = visible_questions(survey, user, is_admin) if user else survey_questions(survey)
        return stage_counts(questions)

    def get_my_question_count(self, survey):
        user, is_admin = self._viewer()
        return len(visible_questions(survey, user, is_admin)) if user else 0

    def get_waiting_on(self, survey):
        """Who is holding the survey up: each respondent with open questions,
        and the reviewer or approver when questions are waiting on them."""
        if survey.status != "in_progress":
            return []
        pending: dict = {}
        for q in survey_questions(survey):
            if q.status in ("awaiting_response", "returned") and q.responder is not None:
                entry = pending.setdefault(("responder", q.responder_id), {"role": "responder", "person": q.responder, "count": 0})
                entry["count"] += 1
            elif q.status == "awaiting_review" and survey.reviewer is not None:
                entry = pending.setdefault(("reviewer", survey.reviewer_id), {"role": "reviewer", "person": survey.reviewer, "count": 0})
                entry["count"] += 1
            elif q.status == "awaiting_approval" and survey.approver is not None:
                entry = pending.setdefault(("approver", survey.approver_id), {"role": "approver", "person": survey.approver, "count": 0})
                entry["count"] += 1
        order = {"responder": 0, "reviewer": 1, "approver": 2}
        holders = sorted(pending.values(), key=lambda h: (order[h["role"]], -h["count"]))
        return [{**h, "person": PersonSerializer(h["person"]).data} for h in holders]

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
    respondents = serializers.SerializerMethodField()

    class Meta(SurveyListSerializer.Meta):
        fields = [
            *SurveyListSerializer.Meta.fields,
            "instructions", "sections", "answers", "draft_answers", "readiness", "history", "created_by", "respondents",
        ]
        read_only_fields = fields

    def to_representation(self, survey):
        """Everything here is cut down to the questions this person may see:
        a respondent gets only their own, the reviewer and approver only what has
        reached them, and the activity log only the steps that concern those."""
        data = super().to_representation(survey)
        # Numbers follow the whole survey, so Q57 is Q57 to everyone who can see it.
        number = 0
        for section in data["sections"]:
            for q in section["questions"]:
                number += 1
                q["number"] = number
        user, is_admin = self._viewer()
        # Work in progress belongs to the respondent alone, administrators included.
        own = {str(q.pk) for q in survey_questions(survey) if user is not None and q.responder_id == user.pk}
        data["draft_answers"] = {k: v for k, v in data["draft_answers"].items() if k in own}
        if user is None or is_admin:
            return data
        seen = {str(q.pk) for q in visible_questions(survey, user, is_admin)}
        sections = []
        for section in data["sections"]:
            questions = [q for q in section["questions"] if q["id"] in seen]
            if questions:
                sections.append({**section, "questions": questions})
        data["sections"] = sections
        data["answers"] = {k: v for k, v in data["answers"].items() if k in seen}
        history = []
        for event in data["history"]:
            if event["question_ids"]:
                ids = [i for i in event["question_ids"] if i in seen]
                if not ids:
                    continue
                event = {
                    **event,
                    "question_ids": ids,
                    "snapshot": {k: v for k, v in event["snapshot"].items() if k in seen},
                    "question_comments": [c for c in event["question_comments"] if c["question_id"] in seen],
                }
            history.append(event)
        data["history"] = history
        return data

    def get_respondents(self, survey):
        """Each respondent with the stage of their questions. Respondents don't
        see each other, so they get an empty list."""
        user, is_admin = self._viewer()
        if user is not None and not is_admin and survey.reviewer_id != user.pk and survey.approver_id != user.pk:
            return []
        by_person: dict = {}
        for q in survey_questions(survey):
            if q.responder is None or (user is not None and not can_see(q, survey, user, is_admin)):
                continue
            entry = by_person.setdefault(q.responder_id, {"person": q.responder, "questions": []})
            entry["questions"].append(q)
        rows = [
            {"person": PersonSerializer(e["person"]).data, "stats": stage_counts(e["questions"]), "question_ids": [str(q.pk) for q in e["questions"]]}
            for e in by_person.values()
        ]
        return sorted(rows, key=lambda r: r["person"]["full_name"].lower())

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
    reviewer_id = IdField(source="reviewer", queryset=User.objects.all(), required=False, allow_null=True)
    approver_id = IdField(source="approver", queryset=User.objects.all(), required=False, allow_null=True)


class SubmitSerializer(serializers.Serializer):
    answers = serializers.DictField()
    # Which of the respondent's questions to submit; all open ones when omitted.
    question_ids = serializers.ListField(child=serializers.UUIDField(), required=False, allow_null=True, default=None)


class DraftSerializer(serializers.Serializer):
    answers = serializers.DictField()


class QuestionNoteSerializer(serializers.Serializer):
    question_id = serializers.UUIDField()
    text = serializers.CharField(allow_blank=True)


class DecisionSerializer(serializers.Serializer):
    decision = serializers.CharField()
    comment = serializers.CharField(required=False, allow_blank=True, default="")
    question_comments = QuestionNoteSerializer(many=True, required=False, default=list)
    # Which questions the decision covers; all that are waiting when omitted.
    question_ids = serializers.ListField(child=serializers.UUIDField(), required=False, allow_null=True, default=None)
    # Who a return goes to. The reviewer's is always the respondent.
    audience = serializers.ChoiceField(choices=["responder", "reviewer", "both"], required=False, default="responder")


class AssignmentSerializer(serializers.Serializer):
    question_id = serializers.UUIDField()
    responder_id = IdField(source="responder", queryset=User.objects.all(), allow_null=True)


class AssignSerializer(serializers.Serializer):
    assignments = AssignmentSerializer(many=True)


class CloseSerializer(serializers.Serializer):
    comment = serializers.CharField(required=False, allow_blank=True, default="")


class MoveSerializer(serializers.Serializer):
    direction = serializers.ChoiceField(choices=["up", "down"])
