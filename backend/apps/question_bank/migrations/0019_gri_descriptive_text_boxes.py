from django.db import migrations

from apps.question_bank.gri_loader import load_disclosures


def forwards(apps, schema_editor):
    # GRI 1 and GRI 2: descriptive questions become free-text boxes (they were choice lists)
    load_disclosures(apps, "gri", slugs=["gri-1-foundation", "gri-2-general-disclosures"])


class Migration(migrations.Migration):
    dependencies = [("question_bank", "0018_reload_rspo_titles")]
    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
