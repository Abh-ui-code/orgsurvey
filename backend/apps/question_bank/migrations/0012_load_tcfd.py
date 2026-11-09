from django.db import migrations

from apps.question_bank.gri_loader import load_tcfd


def forwards(apps, schema_editor):
    load_tcfd(apps)


class Migration(migrations.Migration):
    dependencies = [("question_bank", "0011_tcfd_framework")]
    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
