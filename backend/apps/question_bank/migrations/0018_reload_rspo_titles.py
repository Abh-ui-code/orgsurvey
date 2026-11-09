from django.db import migrations

from apps.question_bank.gri_loader import load_rspo


def forwards(apps, schema_editor):
    load_rspo(apps)  # reloads the RSPO questions so long criterion titles are kept whole


class Migration(migrations.Migration):
    dependencies = [("question_bank", "0017_gri_title_text")]
    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
