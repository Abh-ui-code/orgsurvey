from django.db import migrations

from apps.question_bank.gri_loader import load_disclosures

SLUGS = ["gri-1-foundation", "gri-2-general-disclosures", "gri-3-material-topics", "gri-11-oil-and-gas-sector"]


def forwards(apps, schema_editor):
    """Most descriptive questions in GRI 1, 2, 3 and 11 become tables (one row per item the disclosure asks for).
    Questions are updated in place, so surveys built from them stay linked."""
    load_disclosures(apps, "gri", slugs=SLUGS)


class Migration(migrations.Migration):
    dependencies = [("question_bank", "0027_table_headers")]
    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
