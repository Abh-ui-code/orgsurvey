"""Move the workflow from the survey to each question.

Every existing question gets the survey's respondent and a status derived from
where the survey stood; old events are tied to all of the survey's questions
so the audit trail keeps reading the same."""
from django.db import migrations, models

PROGRESS = {"awaiting_response": 0, "returned": 1, "awaiting_review": 1, "awaiting_approval": 2, "approved": 2}


def forwards(apps, schema_editor):
    Survey = apps.get_model("surveys", "Survey")
    SurveyQuestion = apps.get_model("surveys", "SurveyQuestion")
    SurveyEvent = apps.get_model("surveys", "SurveyEvent")
    for survey in Survey.objects.all():
        old = survey.status
        question_status = old if old in PROGRESS else "awaiting_response"
        questions = list(SurveyQuestion.objects.filter(section__survey=survey))
        submitted = survey.events.filter(action="submitted").exists()
        reviewed = survey.events.filter(action="reviewed").exists()
        for q in questions:
            q.responder_id = survey.responder_id
            if old in PROGRESS:
                q.status = question_status
                q.progress = max(PROGRESS[question_status], 2 if reviewed else 1 if submitted else 0)
            q.save(update_fields=["responder", "status", "progress"])
        for event in survey.events.all():
            if event.action in ("submitted", "reviewed", "approved", "returned"):
                event.questions.set(questions)
        if old in ("awaiting_response", "awaiting_review", "awaiting_approval", "returned"):
            survey.status = "in_progress"
            survey.save(update_fields=["status"])


class Migration(migrations.Migration):

    dependencies = [
        ("surveys", "0004_event_snapshot"),
    ]

    operations = [
        migrations.AddField(
            model_name="surveyquestion",
            name="responder",
            field=models.ForeignKey(blank=True, db_constraint=False, null=True, on_delete=models.deletion.SET_NULL, related_name="+", to="users.user"),
        ),
        migrations.AddField(
            model_name="surveyquestion",
            name="status",
            field=models.CharField(choices=[("awaiting_response", "Awaiting response"), ("awaiting_review", "Awaiting review"), ("awaiting_approval", "Awaiting approval"), ("returned", "Returned"), ("approved", "Approved")], db_index=True, default="awaiting_response", max_length=20),
        ),
        migrations.AddField(
            model_name="surveyquestion",
            name="progress",
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="surveyevent",
            name="questions",
            field=models.ManyToManyField(blank=True, related_name="events", to="surveys.surveyquestion"),
        ),
        migrations.AlterField(
            model_name="survey",
            name="status",
            field=models.CharField(choices=[("draft", "Draft"), ("in_progress", "In progress"), ("approved", "Approved"), ("closed", "Closed")], db_index=True, default="draft", max_length=20),
        ),
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]
