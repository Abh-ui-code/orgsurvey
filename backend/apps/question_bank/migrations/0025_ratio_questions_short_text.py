from django.db import migrations

from apps.question_bank.gri_loader import load_disclosures


def forwards(apps, schema_editor):
    # Ratio questions are one-line text boxes ("3:1")
    load_disclosures(apps, "gri", slugs=["gri-2-general-disclosures"])
    load_disclosures(apps, "wef")


class Migration(migrations.Migration):
    dependencies = [("question_bank", "0024_ratio_questions_as_text")]
    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
