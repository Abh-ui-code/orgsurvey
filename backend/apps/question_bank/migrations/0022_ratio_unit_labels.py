from django.db import migrations

from apps.question_bank.gri_loader import load_disclosures


def forwards(apps, schema_editor):
    load_disclosures(apps, "gri", slugs=["gri-2-general-disclosures"])  # 2-21 a and b: clearer unit and hint


class Migration(migrations.Migration):
    dependencies = [("question_bank", "0021_load_units_and_tables")]
    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
