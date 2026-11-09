from django.db import migrations

from apps.question_bank.gri_loader import load_disclosures


def forwards(apps, schema_editor):
    load_disclosures(apps, "sasb")


class Migration(migrations.Migration):
    dependencies = [("question_bank", "0009_load_gri_disclosures")]
    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
