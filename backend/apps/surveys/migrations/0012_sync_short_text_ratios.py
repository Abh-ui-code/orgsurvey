from django.db import migrations

from apps.surveys.sync_questions import sync_unanswered


class Migration(migrations.Migration):
    dependencies = [
        ("surveys", "0011_sync_unanswered_standard_questions"),
        ("question_bank", "0025_ratio_questions_short_text"),
    ]
    operations = [migrations.RunPython(lambda apps, schema_editor: sync_unanswered(apps), migrations.RunPython.noop)]
