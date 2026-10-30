from django.db import models

from apps.core.models import AuthoredModel, BaseModel


class BankCategory(BaseModel):
    """A topic the reusable questions are filed under -- managed by admins."""

    label = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    display_order = models.PositiveIntegerField(default=0)
    # Filed by the system (GRI questions); hidden from the category pickers and not deletable.
    is_system = models.BooleanField(default=False)

    class Meta:
        app_label = "question_bank"
        ordering = ["display_order", "label"]
        verbose_name_plural = "bank categories"

    def __str__(self):
        return self.label


class GriStandard(BaseModel):
    """One GRI Standard (GRI 11: Oil and Gas Sector, GRI 401: Employment ...).
    Its questions are the disclosures in the published PDF. A survey takes the
    whole standard as one section, never question by question."""

    SERIES = [
        ("universal", "Universal Standards"),
        ("sector", "Sector Standards"),
        ("economic", "Economic topics"),
        ("environmental", "Environmental topics"),
        ("social", "Social topics"),
    ]

    slug = models.SlugField(max_length=100, unique=True)
    code = models.CharField(max_length=20)  # "GRI 401"
    number = models.PositiveIntegerField()
    title = models.CharField(max_length=255)  # "Employment"
    edition = models.CharField(max_length=30, blank=True)  # "2016", "2021 V1.1"
    series = models.CharField(max_length=20, choices=SERIES)
    summary = models.TextField(blank=True)
    pdf = models.CharField(max_length=255, blank=True)  # served by the web app, e.g. /gri/gri-401-employment.pdf
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        app_label = "question_bank"
        ordering = ["display_order", "code"]

    def __str__(self):
        return f"{self.code}: {self.title}"


class Question(AuthoredModel, BaseModel):
    """A reusable question. Surveys copy it rather than point at it, so later
    edits here never change a survey that already exists."""

    category = models.ForeignKey(BankCategory, on_delete=models.PROTECT, related_name="questions")
    text = models.TextField()
    type = models.CharField(max_length=20, default="text")
    options = models.JSONField(default=list, blank=True)
    hint = models.CharField(max_length=500, blank=True)
    required = models.BooleanField(default=True)
    # Set on the questions that belong to a GRI Standard (the disclosure number, e.g. "401-1").
    gri_standard = models.ForeignKey(GriStandard, null=True, blank=True, on_delete=models.CASCADE, related_name="questions")
    gri_ref = models.CharField(max_length=30, blank=True)
    gri_order = models.PositiveIntegerField(default=0)

    class Meta:
        app_label = "question_bank"
        ordering = ["created_at"]

    def __str__(self):
        return self.text[:60]
