"""The WEF Stakeholder Capitalism Metrics data: four pillars with 21 core and 34 expanded metrics, each pillar
with a PDF and valid questions. No database."""
import json
from pathlib import Path

import pytest

from apps.core.question_types import clean_question_fields

DATA = Path(__file__).resolve().parents[1] / "apps" / "question_bank" / "data"
PUBLIC = Path(__file__).resolve().parents[2] / "public"
MANIFEST = json.loads((DATA / "wef_manifest.json").read_text())


def _groups(entry):
    return json.loads((DATA / "wef" / f"{entry['slug']}.json").read_text())["disclosures"]


def test_four_pillars_with_21_core_and_34_expanded_metrics():
    assert [m["title"] for m in MANIFEST] == ["Principles of Governance", "Planet", "People", "Prosperity"]
    groups = [g for m in MANIFEST for g in _groups(m)]
    assert sum(g["ref"] == "Core" for g in groups) == 21
    assert sum(g["ref"] == "Expanded" for g in groups) == 34


@pytest.mark.parametrize("entry", MANIFEST, ids=lambda m: m["title"])
def test_pillar_has_pdf_and_valid_questions(entry):
    assert (PUBLIC / entry["pdf"].lstrip("/")).is_file()
    for group in _groups(entry):
        assert group["ref"] in ("Core", "Expanded") and group["title"] and group["questions"]
        for q in group["questions"]:
            fields = clean_question_fields(q)
            assert fields["text"].endswith("?")
            assert len(fields["hint"]) <= 500
