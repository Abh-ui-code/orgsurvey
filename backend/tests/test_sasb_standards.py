"""The SASB question bank data: every industry in the manifest has a PDF and a question per metric, grouped by topic,
and every question passes the same rules the app applies to any question. No database."""
import json
from pathlib import Path

import pytest

from apps.core.question_types import clean_question_fields
from apps.question_bank.models import GriStandard

DATA = Path(__file__).resolve().parents[1] / "apps" / "question_bank" / "data"
PUBLIC = Path(__file__).resolve().parents[2] / "public"
MANIFEST = json.loads((DATA / "sasb_manifest.json").read_text())
SECTORS = {key for key, _ in GriStandard.SERIES} - {"universal", "sector", "economic", "environmental", "social", "tcfd", "rspo", "wef"}


def test_all_77_industries_are_listed_once():
    assert len(MANIFEST) == 77
    assert len({m["slug"] for m in MANIFEST}) == 77
    assert len({m["code"] for m in MANIFEST}) == 77
    assert {m["series"] for m in MANIFEST} == SECTORS


@pytest.mark.parametrize("entry", MANIFEST, ids=lambda m: m["code"])
def test_industry_has_pdf_and_valid_questions(entry):
    assert (PUBLIC / entry["pdf"].lstrip("/")).is_file()
    content = json.loads((DATA / "sasb" / f"{entry['slug']}.json").read_text())
    assert content["summary"]
    groups = content["disclosures"]
    assert groups and all(g["title"] for g in groups)
    questions = [(g["ref"] + q["item"], q) for g in groups for q in g["questions"]]
    codes = [code for code, _ in questions]
    assert codes and len(set(codes)) == len(codes)
    assert all(c.startswith(entry["code"] + "-") for c in codes)
    for _, q in questions:
        fields = clean_question_fields(q)  # raises ApiError on a bad type, options or empty text
        assert fields["text"].endswith("?")
        assert len(fields["hint"]) <= 500
