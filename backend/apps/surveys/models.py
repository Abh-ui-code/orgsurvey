import os

from django.db import connection, models

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

    The workflow runs per question (see SurveyQuestion.status): each question
    has one respondent and moves through review and approval on its own. The
    survey itself is only draft -> in_progress -> approved (once every
    question is approved), or closed when an administrator withdraws it.
    Once published, the structure is frozen.
    """

    STATUSES = [
        ("draft", "Draft"),
        ("in_progress", "In progress"),
        ("approved", "Approved"),
        ("closed", "Closed"),
    ]
    LIVE = ("in_progress",)

    category = models.ForeignKey(SurveyCategory, on_delete=models.PROTECT, related_name="surveys")
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    instructions = models.TextField(blank=True)
    # The org block this survey is about.
    target_unit = models.ForeignKey("organisation.OrgUnit", on_delete=models.PROTECT, related_name="surveys")
    status = models.CharField(max_length=20, choices=STATUSES, default="draft", db_index=True)
    # The reviewer and approver handle every question. Respondents are set per
    # question (SurveyQuestion.responder); this field is unused, kept for old data.
    responder = user_fk()
    reviewer = user_fk()
    approver = user_fk()
    due_date = models.DateField(null=True, blank=True)
    answers = models.JSONField(default=dict, blank=True)  # submitted answers from every respondent: {survey_question_id: answer}
    # The respondent's work in progress. Kept apart from `answers` so that
    # saving a draft never changes what a reviewer or approver is looking at.
    draft_answers = models.JSONField(default=dict, blank=True)
    # A note the respondent leaves for the reviewer on a question, kept the same way:
    # `notes` once submitted, `draft_notes` while still being written. {survey_question_id: text}
    notes = models.JSONField(default=dict, blank=True)
    draft_notes = models.JSONField(default=dict, blank=True)
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
    # A whole GRI Standard added as a section: its questions are fixed and it is assigned to one respondent.
    gri_standard = models.ForeignKey(
        "question_bank.GriStandard", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )

    class Meta:
        app_label = "surveys"
        ordering = ["order", "id"]

    def __str__(self):
        return self.title


class SurveyQuestion(BaseModel):
    """A question inside a survey: a copy of a bank question, or written fresh.
    It has exactly one respondent and its own place in the workflow."""

    STATUSES = [
        ("awaiting_response", "Awaiting response"),
        ("awaiting_review", "Awaiting review"),
        ("awaiting_approval", "Awaiting approval"),
        ("returned", "Returned"),
        ("approved", "Approved"),
    ]
    # Furthest point reached, so the reviewer and approver can keep seeing a
    # question after it has moved on or been sent back: 0 not submitted,
    # 1 submitted, 2 passed review.
    PROGRESS_SUBMITTED, PROGRESS_REVIEWED = 1, 2

    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name="questions")
    order = models.PositiveIntegerField(default=0)
    text = models.TextField()
    type = models.CharField(max_length=20, default="text")
    options = models.JSONField(default=list, blank=True)
    # A number question's unit ("hectares", "%"), shown beside the box so the respondent only types the figure.
    unit = models.CharField(max_length=40, blank=True)
    # A table question's rows: [{"label", "kind": "number" | "text", "unit"}], one answer box per row.
    parts = models.JSONField(default=list, blank=True)
    hint = models.CharField(max_length=500, blank=True)
    required = models.BooleanField(default=True)
    bank_question = models.ForeignKey(
        "question_bank.Question", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    responder = user_fk()
    status = models.CharField(max_length=20, choices=STATUSES, default="awaiting_response", db_index=True)
    progress = models.PositiveSmallIntegerField(default=0)

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
    # For a submission: the note and files that went with each answer, kept for the same
    # reason. {survey_question_id: {"note": str, "files": [{"id", "name", "size"}]}}
    details = models.JSONField(default=dict, blank=True)
    # The questions this step was about: a respondent submitting 50 of 100, a
    # reviewer returning 3. Empty for steps about the whole survey.
    questions = models.ManyToManyField(SurveyQuestion, blank=True, related_name="events")

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


def _attachment_path(instance, filename):
    return f"{connection.schema_name}/survey-attachments/{instance.question.section.survey_id}/{instance.id}{os.path.splitext(filename)[1].lower()}"


class QuestionAttachment(BaseModel):
    """A file a respondent attached to one question as evidence. Private to the
    respondent until the question is submitted (`submitted`), then visible to
    whoever can see that question."""

    question = models.ForeignKey(SurveyQuestion, on_delete=models.CASCADE, related_name="attachments")
    uploaded_by = user_fk()
    file = models.FileField(upload_to=_attachment_path)
    name = models.CharField(max_length=255)
    size = models.PositiveIntegerField(default=0)
    content_type = models.CharField(max_length=100, blank=True)
    submitted = models.BooleanField(default=False)
    # "response": the respondent's evidence. "review": a file the reviewer or approver
    # attached while deciding; it is tied to the note (`comment`) it was sent with,
    # and until then is private to whoever attached it.
    kind = models.CharField(max_length=10, default="response")
    # Taken off the question by the respondent after it had been submitted. It no longer
    # shows on the form, but the earlier submission it went with still lists it.
    removed = models.BooleanField(default=False)
    comment = models.ForeignKey(QuestionComment, null=True, blank=True, on_delete=models.CASCADE, related_name="attachments")

    class Meta:
        app_label = "surveys"
        ordering = ["created_at", "id"]
