from django.db import models

from apps.core.models import AuthoredModel, BaseModel


class BankCategory(BaseModel):
    """A topic the reusable questions are filed under -- managed by admins."""

    label = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        app_label = "question_bank"
        ordering = ["display_order", "label"]
        verbose_name_plural = "bank categories"

    def __str__(self):
        return self.label


class Question(AuthoredModel, BaseModel):
    """A reusable question. Surveys copy it rather than point at it, so later
    edits here never change a survey that already exists."""

    category = models.ForeignKey(BankCategory, on_delete=models.PROTECT, related_name="questions")
    text = models.TextField()
    type = models.CharField(max_length=20, default="text")
    options = models.JSONField(default=list, blank=True)
    hint = models.CharField(max_length=500, blank=True)
    required = models.BooleanField(default=True)

    class Meta:
        app_label = "question_bank"
        ordering = ["created_at"]

    def __str__(self):
        return self.text[:60]
