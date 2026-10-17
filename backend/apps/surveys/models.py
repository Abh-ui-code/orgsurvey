from django.db import models

from apps.core.models import AuthoredModel, BaseModel, user_fk


class SurveyCategory(BaseModel):
    """The topic a survey belongs to -- Employee Engagement, Compliance, and
    so on. Managed by admins in Settings."""

    COLORS = ["brand", "amber", "moss", "rust", "slate"]

    code = models.SlugField(max_length=50, unique=True)
    label = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    color = models.CharField(max_length=20, default="brand")
    display_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        app_label = "surveys"
        ordering = ["display_order", "label"]
        verbose_name_plural = "survey categories"

    def __str__(self):
        return self.label


class Survey(AuthoredModel, BaseModel):
    """
    An organisational survey, built as a draft and then published.

    Lifecycle:  draft -> (publish) -> awaiting_response -> awaiting_review
                -> awaiting_approval -> approved, with `returned` as the
                send-back loop and `closed` as an administrator withdrawing it.
    Once published, the structure is frozen: the respondent, reviewer and
    approver all see exactly the same questions for the life of the survey.
    """

    STATUSES = [
        ("draft", "Draft"),
        ("awaiting_response", "Awaiting response"),
        ("awaiting_review", "Awaiting review"),
        ("awaiting_approval", "Awaiting approval"),
        ("returned", "Returned"),
        ("approved", "Approved"),
        ("closed", "Closed"),
    ]
    LIVE = ("awaiting_response", "awaiting_review", "awaiting_approval", "returned")

    category = models.ForeignKey(SurveyCategory, on_delete=models.PROTECT, related_name="surveys")
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    instructions = models.TextField(blank=True)
    # The org block this survey is about.
    target_unit = models.ForeignKey("organisation.OrgUnit", on_delete=models.PROTECT, related_name="surveys")
    status = models.CharField(max_length=20, choices=STATUSES, default="draft", db_index=True)
    # The three people. Optional while drafting, all required to publish.
    responder = user_fk()
    reviewer = user_fk()
    approver = user_fk()
    due_date = models.DateField(null=True, blank=True)
    answers = models.JSONField(default=dict, blank=True)  # the submitted response: {survey_question_id: answer}
    # The respondent's work in progress. Kept apart from `answers` so that
    # saving a draft never changes what a reviewer or approver is looking at.
    draft_answers = models.JSONField(default=dict, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        app_label = "surveys"
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


class Section(BaseModel):
    survey = models.ForeignKey(Survey, on_delete=models.CASCADE, related_name="sections")
    order = models.PositiveIntegerField(default=0)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    class Meta:
        app_label = "surveys"
        ordering = ["order", "id"]

    def __str__(self):
        return self.title


class SurveyQuestion(BaseModel):
    """A question inside a survey: a copy of a bank question, or written fresh."""

    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name="questions")
    order = models.PositiveIntegerField(default=0)
    text = models.TextField()
    type = models.CharField(max_length=20, default="text")
    options = models.JSONField(default=list, blank=True)
    hint = models.CharField(max_length=500, blank=True)
    required = models.BooleanField(default=True)
    bank_question = models.ForeignKey(
        "question_bank.Question", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )

    class Meta:
        app_label = "surveys"
        ordering = ["order", "id"]

    def __str__(self):
        return self.text[:60]


class SurveyEvent(BaseModel):
    """One entry in a survey's activity log."""

    ACTIONS = ("created", "published", "submitted", "reviewed", "approved", "returned", "closed")

    survey = models.ForeignKey(Survey, on_delete=models.CASCADE, related_name="events")
    action = models.CharField(max_length=20, choices=[(a, a) for a in ACTIONS])
    by = user_fk()
    comment = models.TextField(blank=True)
    # For a return: who it was sent back to -- respondent, reviewer or both.
    audience = models.CharField(max_length=10, blank=True)
    # For a submission: the answers as they were sent, kept for the audit
    # trail because a resubmission overwrites `Survey.answers`.
    snapshot = models.JSONField(default=dict, blank=True)

    class Meta:
        app_label = "surveys"
        ordering = ["created_at", "id"]


class QuestionComment(BaseModel):
    """A note a reviewer or approver pinned to one question when returning a
    survey. It belongs to the return event that carried it, so the
    audience (respondent, reviewer or both) is read from there."""

    event = models.ForeignKey(SurveyEvent, on_delete=models.CASCADE, related_name="question_comments")
    question = models.ForeignKey(SurveyQuestion, on_delete=models.CASCADE, related_name="comments")
    author = user_fk()
    text = models.TextField()

    class Meta:
        app_label = "surveys"
        ordering = ["created_at", "id"]
