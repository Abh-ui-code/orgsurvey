from django.db import migrations

from apps.question_bank.gri_loader import load_rspo


def forwards(apps, schema_editor):
    load_rspo(apps)


class Migration(migrations.Migration):
    dependencies = [("question_bank", "0013_rspo_framework")]
    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
