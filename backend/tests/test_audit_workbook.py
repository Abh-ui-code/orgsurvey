"""The audit-trail workbook: sheets, return counts and per-question comments."""
from datetime import datetime, timezone
from io import BytesIO
from types import SimpleNamespace as NS

from openpyxl import load_workbook

from apps.reports import audit


class FakeQS(list):
    def select_related(self, *a):
        return self

    def prefetch_related(self, *a):
        return self

    def filter(self, **kw):
        return self

    def order_by(self, *a):
        return self


class Many:
    def __init__(self, items):
        self._items = items

    def all(self):
        return self._items


def at(day):
    return datetime(2026, 10, day, 9, 0, tzinfo=timezone.utc)


def test_workbook_describes_the_whole_flow(monkeypatch):
    section = NS(title="Processes")
    q1 = NS(pk="q1", id="q1", section=section, text="Documented?", type="yes_no", options=[], required=True, hint="")
    q2 = NS(pk="q2", id="q2", section=section, text="Rate it", type="rating", options=[], required=True, hint="")
    monkeypatch.setattr(audit.SurveyQuestion, "objects", NS(filter=lambda **kw: FakeQS([q1, q2])))

    people = {k: NS(pk=k, full_name=k.title(), email=f"{k}@x") for k in ("responder", "reviewer", "approver")}
    note = NS(question_id="q2", text="Too high, explain", author=people["approver"])
    events = [
        NS(action="created", by=None, by_id=None, created_at=at(1), comment="", audience="", snapshot={}, question_comments=Many([])),
        NS(action="submitted", by=people["responder"], by_id="responder", created_at=at(2), comment="", audience="", snapshot={"q1": "Yes", "q2": 5}, question_comments=Many([])),
        NS(action="returned", by=people["approver"], by_id="approver", created_at=at(3), comment="See Q2", audience="both", snapshot={}, question_comments=Many([note])),
        NS(action="submitted", by=people["responder"], by_id="responder", created_at=at(4), comment="", audience="", snapshot={"q1": "Yes", "q2": 3}, question_comments=Many([])),
        NS(action="approved", by=people["approver"], by_id="approver", created_at=at(5), comment="", audience="", snapshot={}, question_comments=Many([])),
    ]
    survey = NS(
        title="Pulse", description="", instructions="", status="approved", due_date=None, created_at=at(1), published_at=at(1),
        category=NS(label="Ops"), target_unit=NS(name="Eng"), created_by=None, answers={"q1": "Yes", "q2": 3},
        events=NS(select_related=lambda *a: NS(prefetch_related=lambda *b: FakeQS(events))), **people,
    )
    wb = load_workbook(BytesIO(audit.build_workbook(survey)))

    assert wb.sheetnames == ["Summary", "Questions", "Audit trail", "Returns", "Answers by round"]
    summary = dict(wb["Summary"].iter_rows(min_row=2, max_col=2, values_only=True))
    assert summary["Times submitted"] == 2 and summary["Times returned"] == 1
    assert summary["Returned to reviewer"] == 1 and summary["Question comments in total"] == 1
    assert len(list(wb["Audit trail"].iter_rows(min_row=2))) == 5
    returns = list(wb["Returns"].iter_rows(min_row=2, values_only=True))
    assert returns[0][4] == "Responder and reviewer" and returns[0][8] == "Rate it" and returns[0][9] == "Too high, explain"
    rounds = list(wb["Answers by round"].iter_rows(min_row=2, values_only=True))
    assert rounds[1][3:] == (5, 3)
