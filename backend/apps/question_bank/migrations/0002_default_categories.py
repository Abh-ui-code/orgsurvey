from django.db import migrations

DEFAULTS = ["Engagement", "Wellbeing", "Resources", "Process", "Collaboration", "Challenges", "Improvement", "General"]


def create_defaults(apps, schema_editor):
    BankCategory = apps.get_model("question_bank", "BankCategory")
    for order, label in enumerate(DEFAULTS, start=1):
        BankCategory.objects.get_or_create(label=label, defaults={"display_order": order})


class Migration(migrations.Migration):
    dependencies = [("question_bank", "0001_initial")]
    operations = [migrations.RunPython(create_defaults, migrations.RunPython.noop)]
