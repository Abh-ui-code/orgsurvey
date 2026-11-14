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
        content = json.loads(content_file.read_text()) if content_file.exists() else {"summary": ""}
        standard, _ = GriStandard.objects.update_or_create(
            slug=entry["slug"],
            defaults={
                "code": entry["code"], "number": entry["number"], "title": entry["title"], "edition": entry["edition"],
                "series": entry["series"], "summary": content["summary"], "pdf": entry["pdf"], "display_order": entry["order"],
            },
        )
        # Questions are loaded by load_disclosures (migration 0009), grouped by disclosure.


def load_disclosures(apps, framework="gri", slugs=None):
    """Replaces a framework's standard questions with the ones in data/<framework>/*.json: one group per
    disclosure (GRI), sector topic or SASB topic as numbered in the PDF, one question per requirement
    item (a, b, c ...) or metric (.1, .2 ...).

    Questions are updated in place (matched by their PDF number), so a survey built from them keeps its link to
    them and its numbering; surveys copy the text, so they are never changed. `slugs` limits the reload to those standards."""
    GriStandard = apps.get_model("question_bank", "GriStandard")
    Question = apps.get_model("question_bank", "Question")
    BankCategory = apps.get_model("question_bank", "BankCategory")

    category = BankCategory.objects.get(label=CATEGORIES[framework])
    standards = GriStandard.objects.filter(framework=framework)
    if slugs is not None:
        standards = standards.filter(slug__in=slugs)
    for standard in standards:
        content_file = DATA / framework / f"{standard.slug}.json"
        if not content_file.exists():
            continue
        content = json.loads(content_file.read_text())
        # Update in place by PDF number (group + item) so surveys already built from a question stay linked to it;
        # only questions that no longer exist in the data are removed.
        existing = {(q.gri_ref, q.gri_title, q.gri_item): q for q in Question.objects.filter(gri_standard=standard)}
        keep, rows, order = set(), [], 0
        for disclosure in content.get("disclosures", []):
            for q in disclosure["questions"]:
                key = (disclosure["ref"], disclosure["title"], q.get("item", ""))
                fields = {
                    "category": category, "gri_order": order, "text": q["text"], "type": q.get("type", "text"),
                    "hint": q.get("hint", "")[:500], "options": q.get("options", []), "required": True,
                    "unit": q.get("unit", ""), "parts": q.get("parts", []),
                }
                found = existing.get(key)
                if found is not None:
                    for name, value in fields.items():
                        setattr(found, name, value)
                    found.save()
                    keep.add(found.pk)
                else:
                    rows.append(Question(gri_standard=standard, gri_ref=key[0], gri_title=key[1], gri_item=key[2], **fields))
                order += 1
        Question.objects.filter(gri_standard=standard).exclude(pk__in=keep).delete()
        Question.objects.bulk_create(rows)


def convert_to_choices(apps):
    """Give existing bank questions the select types and options now in the data files.

    Only questions still of type text are touched, so edits made in the app are kept."""
    GriStandard = apps.get_model("question_bank", "GriStandard")
    Question = apps.get_model("question_bank", "Question")
    for standard in GriStandard.objects.all():
        content_file = DATA / "gri" / f"{standard.slug}.json"
        if not content_file.exists():
            continue
        for i, q in enumerate(json.loads(content_file.read_text()).get("questions", [])):
            if q.get("options"):
                Question.objects.filter(gri_standard=standard, gri_order=i, gri_ref=q["ref"], type="text").update(
                    text=q["text"], type=q["type"], options=q["options"]
                )


SASB_CATEGORY = "SASB Standards"
TCFD_CATEGORY = "TCFD Recommendations"
RSPO_CATEGORY = "RSPO Standards"
WEF_CATEGORY = "WEF Metrics"
CATEGORIES = {"gri": CATEGORY, "sasb": SASB_CATEGORY, "tcfd": TCFD_CATEGORY, "rspo": RSPO_CATEGORY, "wef": WEF_CATEGORY}


def load_sasb(apps):
    """Loads the SASB industry standards (summary and PDF) from data/sasb/ into the bank.
    Their questions come from load_disclosures(apps, "sasb")."""
    GriStandard = apps.get_model("question_bank", "GriStandard")
    Question = apps.get_model("question_bank", "Question")
    BankCategory = apps.get_model("question_bank", "BankCategory")

    manifest = json.loads((DATA / "sasb_manifest.json").read_text())
    category, _ = BankCategory.objects.get_or_create(
        label=SASB_CATEGORY,
        defaults={"is_system": True, "display_order": 1001, "description": "Questions that come with the SASB Standards."},
    )
    for entry in manifest:
        content_file = DATA / "sasb" / f"{entry['slug']}.json"
        content = json.loads(content_file.read_text()) if content_file.exists() else {"summary": entry["description"]}
        standard, _ = GriStandard.objects.update_or_create(
            slug=entry["slug"],
            defaults={
                "framework": "sasb", "code": entry["code"], "number": entry["number"], "title": entry["title"],
                "edition": entry["edition"], "series": entry["series"], "summary": content["summary"], "pdf": entry["pdf"],
                "display_order": entry["order"],
            },
        )
        # Questions are loaded by load_disclosures(apps, "sasb") (migration 0010).


def _load_framework(apps, framework, manifest_name, folder, category_label, display_order, description):
    """Loads a framework's standards (summary and PDF from data/<folder>/, listed in <manifest_name>) and then
    their questions grouped as in the PDF."""
    GriStandard = apps.get_model("question_bank", "GriStandard")
    BankCategory = apps.get_model("question_bank", "BankCategory")

    manifest = json.loads((DATA / manifest_name).read_text())
    BankCategory.objects.get_or_create(
        label=category_label, defaults={"is_system": True, "display_order": display_order, "description": description}
    )
    for entry in manifest:
        content = json.loads((DATA / folder / f"{entry['slug']}.json").read_text())
        GriStandard.objects.update_or_create(
            slug=entry["slug"],
            defaults={
                "framework": framework, "code": entry["code"], "number": entry["number"], "title": entry["title"],
                "edition": entry["edition"], "series": entry["series"], "summary": content["summary"], "pdf": entry["pdf"],
                "display_order": entry["order"],
            },
        )
    load_disclosures(apps, framework)


def load_tcfd(apps):
    """The TCFD pillars: one standard per pillar, one group per recommended disclosure as in the report."""
    _load_framework(apps, "tcfd", "tcfd_manifest.json", "tcfd", TCFD_CATEGORY, 1002, "Questions that come with the TCFD Recommendations.")


def load_rspo(apps):
    """The RSPO Principles & Criteria: one standard per principle, one group per criterion, one question per indicator."""
    _load_framework(apps, "rspo", "rspo_manifest.json", "rspo", RSPO_CATEGORY, 1003, "Questions that come with the RSPO Principles & Criteria.")


def load_wef(apps):
    """The WEF Stakeholder Capitalism Metrics: one standard per pillar, one group per metric (core or expanded)."""
    _load_framework(apps, "wef", "wef_manifest.json", "wef", WEF_CATEGORY, 1004, "Questions that come with the WEF Stakeholder Capitalism Metrics.")
