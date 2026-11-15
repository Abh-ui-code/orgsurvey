from django.db import migrations, models

from apps.question_bank.gri_loader import table_headers


def forwards(apps, schema_editor):
    """Give every table question in the bank its fixed left and right column headings, without touching
    anything else about it (edits made in the app are kept)."""
    Question = apps.get_model("question_bank", "Question")
    for q in Question.objects.filter(type="table", gri_standard__isnull=False).select_related("gri_standard"):
        q.row_header, q.value_header = table_headers(q.gri_standard.slug, q.gri_ref, q.gri_item)
        q.save(update_fields=["row_header", "value_header"])


class Migration(migrations.Migration):
    dependencies = [("question_bank", "0026_gri1_statement_of_use_table")]
    operations = [
        migrations.AddField(model_name="question", name="row_header", field=models.CharField(blank=True, max_length=80)),
        migrations.AddField(model_name="question", name="value_header", field=models.CharField(blank=True, max_length=80)),
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]
