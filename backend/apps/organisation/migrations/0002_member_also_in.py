from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("organisation", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="member",
            name="also_in",
            field=models.ManyToManyField(blank=True, related_name="associate_members", to="organisation.orgunit"),
        ),
    ]
