"""The TCFD question bank data: four pillars, each with a PDF and valid questions grouped by recommended
disclosure. No database."""
import json
from pathlib import Path

import pytest

from apps.core.question_types import clean_question_fields

DATA = Path(__file__).resolve().parents[1] / "apps" / "question_bank" / "data"
PUBLIC = Path(__file__).resolve().parents[2] / "public"
MANIFEST = json.loads((DATA / "tcfd_manifest.json").read_text())


def test_four_pillars_and_eleven_recommended_disclosures():
    assert [m["title"] for m in MANIFEST] == ["Governance", "Strategy", "Risk Management", "Metrics and Targets"]
    groups = [g for m in MANIFEST for g in json.loads((DATA / "tcfd" / f"{m['slug']}.json").read_text())["disclosures"]]
    assert len(groups) == 11


@pytest.mark.parametrize("entry", MANIFEST, ids=lambda m: m["title"])
def test_pillar_has_pdf_and_valid_questions(entry):
    assert (PUBLIC / entry["pdf"].lstrip("/")).is_file()
    content = json.loads((DATA / "tcfd" / f"{entry['slug']}.json").read_text())
    assert content["summary"]
    for group in content["disclosures"]:
        assert group["ref"].startswith(entry["title"]) and group["title"] and group["questions"]
        for q in group["questions"]:
            fields = clean_question_fields(q)
            assert fields["text"].endswith("?")
            assert len(fields["hint"]) <= 500
