from django.db import migrations

from apps.question_bank.gri_loader import convert_to_choices


def forwards(apps, schema_editor):
    convert_to_choices(apps)


class Migration(migrations.Migration):
    dependencies = [("question_bank", "0004_load_gri_standards")]
    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
