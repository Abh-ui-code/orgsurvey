from django.db import migrations

from apps.question_bank.gri_loader import load_disclosures


def forwards(apps, schema_editor):
    load_disclosures(apps, "gri")


class Migration(migrations.Migration):
    dependencies = [("question_bank", "0008_gri_disclosure_groups")]
    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
