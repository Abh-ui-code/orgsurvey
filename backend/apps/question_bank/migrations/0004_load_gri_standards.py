from django.db import migrations

from apps.question_bank.gri_loader import load


def forwards(apps, schema_editor):
    load(apps)


class Migration(migrations.Migration):
    dependencies = [("question_bank", "0003_gri_standards")]
    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
