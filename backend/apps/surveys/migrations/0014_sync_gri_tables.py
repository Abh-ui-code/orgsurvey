from django.db import migrations

from apps.surveys.sync_questions import sync_unanswered


class Migration(migrations.Migration):
    dependencies = [
        ("surveys", "0013_table_headers"),
        ("question_bank", "0028_gri_1_2_3_11_tables"),
    ]
    # Standard questions nobody has answered yet pick up their new table form; answered ones stay as they were.
    operations = [migrations.RunPython(lambda apps, schema_editor: sync_unanswered(apps), migrations.RunPython.noop)]
