from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("question_bank", "0014_load_rspo")]
    operations = [
        migrations.AlterField(
            "gristandard", "framework",
            models.CharField(
                choices=[
                    ("gri", "GRI Standards"), ("sasb", "SASB Standards"), ("tcfd", "TCFD Recommendations"),
                    ("rspo", "RSPO Standards"), ("wef", "WEF Stakeholder Capitalism Metrics"),
                ],
                default="gri", max_length=10,
            ),
        ),
        migrations.AlterField(
            "gristandard", "series",
            models.CharField(
                choices=[
                    ("universal", "Universal Standards"), ("sector", "Sector Standards"), ("economic", "Economic topics"),
                    ("environmental", "Environmental topics"), ("social", "Social topics"), ("tcfd", "TCFD pillars"),
                    ("rspo", "RSPO principles"), ("wef", "WEF pillars"), ("consumer_goods", "Consumer Goods"),
                    ("extractives", "Extractives & Minerals Processing"), ("financials", "Financials"),
                    ("food_beverage", "Food & Beverage"), ("health_care", "Health Care"), ("infrastructure", "Infrastructure"),
                    ("renewable", "Renewable Resources & Alternative Energy"), ("resource_transf", "Resource Transformation"),
                    ("services", "Services"), ("tech_comms", "Technology & Communications"), ("transportation", "Transportation"),
                ],
                max_length=20,
            ),
        ),
    ]
