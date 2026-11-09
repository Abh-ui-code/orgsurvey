from django.db import migrations

from apps.question_bank.gri_loader import load_sasb


def forwards(apps, schema_editor):
    load_sasb(apps)


class Migration(migrations.Migration):
    dependencies = [("question_bank", "0006_sasb_standards")]
    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
