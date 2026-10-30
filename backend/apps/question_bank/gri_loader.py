"""Loads the GRI Standards (summary, PDF and questions) from data/ into the bank.

Safe to run again: a standard that already has questions is left as it is, so
edits made in the app are never overwritten."""
import json
from pathlib import Path

DATA = Path(__file__).parent / "data"
CATEGORY = "GRI Standards"


def load(apps):
    GriStandard = apps.get_model("question_bank", "GriStandard")
    Question = apps.get_model("question_bank", "Question")
    BankCategory = apps.get_model("question_bank", "BankCategory")

    manifest = json.loads((DATA / "manifest.json").read_text())
    category, _ = BankCategory.objects.get_or_create(
        label=CATEGORY, defaults={"is_system": True, "display_order": 1000, "description": "Questions that come with the GRI Standards."}
    )
    for entry in manifest:
        content_file = DATA / "gri" / f"{entry['slug']}.json"
        content = json.loads(content_file.read_text()) if content_file.exists() else {"summary": "", "questions": []}
        standard, _ = GriStandard.objects.update_or_create(
            slug=entry["slug"],
            defaults={
                "code": entry["code"], "number": entry["number"], "title": entry["title"], "edition": entry["edition"],
                "series": entry["series"], "summary": content["summary"], "pdf": entry["pdf"], "display_order": entry["order"],
            },
        )
        if Question.objects.filter(gri_standard=standard).exists():
            continue
        Question.objects.bulk_create(
            Question(
                category=category, gri_standard=standard, gri_ref=q["ref"], gri_order=i, text=q["text"],
                type=q.get("type", "text"), hint=q.get("hint", "")[:500], options=[], required=True,
            )
            for i, q in enumerate(content["questions"])
        )
