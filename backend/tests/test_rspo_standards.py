"""The RSPO question bank data: seven principles, each with a PDF and valid questions grouped by criterion.
No database."""
import json
from pathlib import Path

import pytest

from apps.core.question_types import clean_question_fields

DATA = Path(__file__).resolve().parents[1] / "apps" / "question_bank" / "data"
PUBLIC = Path(__file__).resolve().parents[2] / "public"
MANIFEST = json.loads((DATA / "rspo_manifest.json").read_text())


def test_seven_principles():
    assert [m["number"] for m in MANIFEST] == list(range(1, 8))


@pytest.mark.parametrize("entry", MANIFEST, ids=lambda m: m["code"])
def test_principle_has_pdf_and_valid_questions(entry):
    assert (PUBLIC / entry["pdf"].lstrip("/")).is_file()
    content = json.loads((DATA / "rspo" / f"{entry['slug']}.json").read_text())
    assert content["summary"]
    numbers = []
    for group in content["disclosures"]:
        assert group["ref"].startswith(f"{entry['number']}.") and group["title"] and group["questions"]
        for q in group["questions"]:
            fields = clean_question_fields(q)
            assert fields["text"].endswith("?")
            assert len(fields["hint"]) <= 500
            numbers.append(group["ref"] + q["item"])
    assert len(set(numbers)) == len(numbers)
