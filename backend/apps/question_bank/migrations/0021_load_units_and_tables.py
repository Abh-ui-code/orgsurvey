from django.db import migrations

from apps.question_bank.gri_loader import load_disclosures


def forwards(apps, schema_editor):
    # Number questions now carry their unit and mixed questions are tables (rows of numbers and text).
    for framework in ("gri", "sasb", "tcfd", "rspo", "wef"):
        load_disclosures(apps, framework)


class Migration(migrations.Migration):
    dependencies = [("question_bank", "0020_question_units_and_tables")]
    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
