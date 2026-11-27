from django.db import migrations

from apps.surveys.sync_questions import sync_unanswered


class Migration(migrations.Migration):
    dependencies = [
        ("surveys", "0014_sync_gri_tables"),
        ("question_bank", "0029_gri_12_tables"),
    ]
    # Unanswered GRI 12 questions pick up their new table form; answered ones stay as they were.
    operations = [migrations.RunPython(lambda apps, schema_editor: sync_unanswered(apps), migrations.RunPython.noop)]
