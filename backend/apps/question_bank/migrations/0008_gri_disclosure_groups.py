from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("question_bank", "0007_load_sasb_standards")]
    operations = [
        migrations.AddField("question", "gri_title", models.CharField(blank=True, max_length=255)),
        migrations.AddField("question", "gri_item", models.CharField(blank=True, max_length=30)),
    ]
