from django.db import migrations, models

from apps.surveys.sync_questions import sync_unanswered


class Migration(migrations.Migration):
    dependencies = [
        ("surveys", "0012_sync_short_text_ratios"),
        ("question_bank", "0027_table_headers"),
    ]
    operations = [
        migrations.AddField(model_name="surveyquestion", name="row_header", field=models.CharField(blank=True, max_length=80)),
        migrations.AddField(model_name="surveyquestion", name="value_header", field=models.CharField(blank=True, max_length=80)),
        # Standard table questions nobody has answered yet pick up their headings; answered ones stay as they were.
        migrations.RunPython(lambda apps, schema_editor: sync_unanswered(apps), migrations.RunPython.noop),
    ]
