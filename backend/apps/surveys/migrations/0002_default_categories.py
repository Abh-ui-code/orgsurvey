from django.db import migrations

# Organisational survey topics every new workspace starts with. Admins can
# rename, recolour, add and switch them off in Settings.
DEFAULTS = [
    ("engagement", "Employee Engagement", "How people feel about their work and team.", "brand"),
    ("hr-people", "HR & People", "Hiring, onboarding, policies and people processes.", "moss"),
    ("operations", "Operations", "How the day-to-day work gets done.", "amber"),
    ("compliance-risk", "Compliance & Risk", "Policies, audits and risk controls.", "rust"),
    ("it-security", "IT & Security", "Systems, tooling and information security.", "slate"),
    ("finance", "Finance", "Budgets, spend and financial processes.", "amber"),
    ("culture-wellbeing", "Culture & Wellbeing", "Values, inclusion and wellbeing.", "moss"),
]


def create_defaults(apps, schema_editor):
    SurveyCategory = apps.get_model("surveys", "SurveyCategory")
    for order, (code, label, description, color) in enumerate(DEFAULTS, start=1):
        SurveyCategory.objects.get_or_create(
            code=code,
            defaults={"label": label, "description": description, "color": color, "display_order": order},
        )


class Migration(migrations.Migration):
    dependencies = [("surveys", "0001_initial")]
    operations = [migrations.RunPython(create_defaults, migrations.RunPython.noop)]
