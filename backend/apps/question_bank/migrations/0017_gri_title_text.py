from django.db import migrations, models


class Migration(migrations.Migration):
    """Criterion titles in the RSPO standard run to several sentences, past 255 characters."""

    dependencies = [("question_bank", "0016_load_wef")]
    operations = [migrations.AlterField("question", "gri_title", models.TextField(blank=True))]
