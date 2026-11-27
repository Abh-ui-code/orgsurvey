from django.db import migrations

from apps.question_bank.gri_loader import load_disclosures

SLUGS = ["gri-12-coal-sector"]


def forwards(apps, schema_editor):
    """Most descriptive questions in GRI 12 (Coal Sector) become tables (one row per item the disclosure asks for).
    Questions are updated in place, so surveys built from them stay linked."""
    load_disclosures(apps, "gri", slugs=SLUGS)


class Migration(migrations.Migration):
    dependencies = [("question_bank", "0028_gri_1_2_3_11_tables")]
    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
