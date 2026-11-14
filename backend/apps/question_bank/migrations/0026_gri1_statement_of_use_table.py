from django.db import migrations

from apps.question_bank.gri_loader import load_disclosures


def forwards(apps, schema_editor):
    """GRI 1 gets a new first question (Requirement 1 a). The old Requirement 1 a becomes 1 b: it is renamed
    first, so the record keeps its id and the surveys built from it stay linked to the right question."""
    Question = apps.get_model("question_bank", "Question")
    Question.objects.filter(
        gri_standard__slug="gri-1-foundation", gri_ref="Requirement 1", gri_item="a", type="yes_no"
    ).update(gri_item="b")
    load_disclosures(apps, "gri", slugs=["gri-1-foundation"])


class Migration(migrations.Migration):
    dependencies = [("question_bank", "0025_ratio_questions_short_text")]
    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
