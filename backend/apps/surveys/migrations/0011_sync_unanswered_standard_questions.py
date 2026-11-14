from django.db import migrations

FIELDS = ("text", "type", "unit", "parts", "options", "hint")


def _convert(value, old_type, new_type):
    """A saved draft answer carried over to the question's new type, or None when it can't be."""
    if old_type == new_type:
        return value
    answer = value.get("answer") if isinstance(value, dict) else value
    extra = value.get("extra") if isinstance(value, dict) else None
    if old_type == "number" and new_type == "text" and isinstance(answer, (int, float)) and not isinstance(answer, bool):
        answer = str(answer)
        return {"answer": answer, "extra": extra} if extra else answer
    return None


def forwards(apps, schema_editor):
    """Surveys keep their own copy of a question. Standard questions nobody has answered yet pick up the bank's
    current wording, type, unit and rows (e.g. ratio questions that are now text boxes). Questions already
    submitted, in review or approved are left exactly as they were."""
    SurveyQuestion = apps.get_model("surveys", "SurveyQuestion")
    Survey = apps.get_model("surveys", "Survey")
    questions = SurveyQuestion.objects.filter(
        status="awaiting_response", bank_question__gri_standard__isnull=False, section__survey__status__in=["draft", "in_progress"]
    ).select_related("bank_question", "section__survey")
    for q in questions:
        bank = q.bank_question
        if all(getattr(q, f) == getattr(bank, f) for f in FIELDS):
            continue
        old_type = q.type
        for f in FIELDS:
            setattr(q, f, getattr(bank, f))
        q.save(update_fields=list(FIELDS))
        if old_type != q.type:
            survey = Survey.objects.get(pk=q.section.survey_id)
            key = str(q.id)
            if key in survey.draft_answers:
                kept = _convert(survey.draft_answers[key], old_type, q.type)
                if kept is None:
                    del survey.draft_answers[key]
                else:
                    survey.draft_answers[key] = kept
                survey.save(update_fields=["draft_answers"])


class Migration(migrations.Migration):
    dependencies = [
        ("surveys", "0010_question_units_and_tables"),
        ("question_bank", "0024_ratio_questions_as_text"),
    ]
    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
