from django.db import migrations

from apps.question_bank.gri_loader import load_wef


def forwards(apps, schema_editor):
    load_wef(apps)


class Migration(migrations.Migration):
    dependencies = [("question_bank", "0015_wef_framework")]
    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
