from django.db import migrations

from apps.question_bank.gri_loader import load_disclosures


def forwards(apps, schema_editor):
    # Ratio questions are typed as text ("3:1"), so a colon can be entered
    load_disclosures(apps, "gri", slugs=["gri-2-general-disclosures"])
    load_disclosures(apps, "wef")


class Migration(migrations.Migration):
    dependencies = [("question_bank", "0023_ratio_shows_colon_one")]
    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
