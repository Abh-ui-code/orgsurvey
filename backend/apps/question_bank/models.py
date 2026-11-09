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
    """One reporting standard with its own PDF and questions: a GRI Standard (GRI 401:
    Employment ...) or a SASB industry standard (CG-AA: Apparel, Accessories &
    Footwear ...). Its questions are the disclosures in the published PDF. A survey
    takes the standard as one section, never question by question. (The name is from
    when GRI was the only framework.)"""

    FRAMEWORKS = [("gri", "GRI Standards"), ("sasb", "SASB Standards"), ("tcfd", "TCFD Recommendations"), ("rspo", "RSPO Standards"), ("wef", "WEF Stakeholder Capitalism Metrics")]
    SERIES = [
        ("universal", "Universal Standards"),
        ("sector", "Sector Standards"),
        ("economic", "Economic topics"),
        ("environmental", "Environmental topics"),
        ("social", "Social topics"),
        # TCFD: the four pillars of the recommendations.
        ("tcfd", "TCFD pillars"),
        # RSPO: the seven principles of the Principles & Criteria.
        ("rspo", "RSPO principles"),
        # WEF: the four pillars of the Stakeholder Capitalism Metrics.
        ("wef", "WEF pillars"),
        # SASB: the sector each industry standard belongs to.
        ("consumer_goods", "Consumer Goods"),
        ("extractives", "Extractives & Minerals Processing"),
        ("financials", "Financials"),
        ("food_beverage", "Food & Beverage"),
        ("health_care", "Health Care"),
        ("infrastructure", "Infrastructure"),
        ("renewable", "Renewable Resources & Alternative Energy"),
        ("resource_transf", "Resource Transformation"),
        ("services", "Services"),
        ("tech_comms", "Technology & Communications"),
        ("transportation", "Transportation"),
    ]

    framework = models.CharField(max_length=10, choices=FRAMEWORKS, default="gri")
    slug = models.SlugField(max_length=100, unique=True)
    code = models.CharField(max_length=20)  # "GRI 401", or the SASB industry code "CG-AA"
    number = models.PositiveIntegerField()
    title = models.CharField(max_length=255)  # "Employment"
    edition = models.CharField(max_length=30, blank=True)  # "2016", "2021 V1.1", SASB "2023-12"
    series = models.CharField(max_length=20, choices=SERIES)
    summary = models.TextField(blank=True)
    pdf = models.CharField(max_length=255, blank=True)  # served by the web app, e.g. /gri/gri-401-employment.pdf or /sasb/sasb-airlines.pdf
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
    # Set on the questions that belong to a standard (GRI disclosure number such as "401-1", or SASB metric code such as "CG-AA-430a.1").
    gri_standard = models.ForeignKey(GriStandard, null=True, blank=True, on_delete=models.CASCADE, related_name="questions")
    gri_ref = models.CharField(max_length=30, blank=True)
    # Where the question sits under its disclosure in the PDF: the title of "Disclosure 305-1" and the
    # requirement letter ("a", "b" ...), so questions are shown grouped and numbered like the PDF.
    gri_title = models.TextField(blank=True)
    gri_item = models.CharField(max_length=30, blank=True)
    gri_order = models.PositiveIntegerField(default=0)

    class Meta:
        app_label = "question_bank"
        ordering = ["created_at"]

    def __str__(self):
        return self.text[:60]
