#!/usr/bin/env python3
"""
End-to-end check of the question-level workflow against a running API
(`make backend`, with the dev tenant seeded). Builds a survey of four questions
split between two respondents and walks it through review and approval,
checking after each step who can see and do what.

    python scripts/question_level_smoke_test.py
"""
import json
import os
import urllib.error
import urllib.request
import uuid

PORT = os.environ.get("PORT", "8000")
HOST = "abc.localhost"
PASSWORD = "devpassword"
passed = failed = 0


def call(method, path, body=None, token=None):
    req = urllib.request.Request(
        f"http://127.0.0.1:{PORT}{path}", method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Host": f"{HOST}:{PORT}", "Content-Type": "application/json", **({"Authorization": f"Bearer {token}"} if token else {})},
    )
    try:
        r = urllib.request.urlopen(req)
        raw = r.read()
        return r.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw[:200]


def ok(name, cond, extra=""):
    global passed, failed
    if cond:
        passed += 1
    else:
        failed += 1
        print("FAIL:", name, extra)


def login(who):
    status, body = call("POST", "/api/auth/login/", {"email": f"{who}@{HOST}", "password": PASSWORD})
    assert status == 200, (who, status, body)
    return body["access"]


T = {who: login(who) for who in ("admin", "priya", "kavya", "vikram", "anita")}
ID = {}
for p in call("GET", "/api/users/?page_size=200", token=T["admin"])[1]["results"]:
    ID[p["email"].split("@")[0]] = p["id"]

# ---- build: four questions, two respondents
s, sv = call("POST", "/api/surveys/", {"title": "QL " + uuid.uuid4().hex[:6], "category_id": call("GET", "/api/survey-categories/", token=T["admin"])[1][0]["id"],
                                         "target_unit_id": call("GET", "/api/units/", token=T["admin"])[1][0]["id"]}, T["admin"])
assert s == 201, sv
S = f"/api/surveys/{sv['id']}"
section = sv["sections"][0]["id"]
qs = []
for i in range(4):
    s, q = call("POST", f"{S}/sections/{section}/questions/", {"text": f"Question {i + 1}", "type": "text", "options": [], "hint": "", "required": True}, T["admin"])
    assert s == 201, q
    qs.append(q["id"])
ok("a draft can't be published without respondents, reviewer and approver", call("POST", f"{S}/publish/", token=T["admin"])[0] == 400)
call("PATCH", f"{S}/", {"reviewer_id": ID["vikram"], "approver_id": ID["anita"]}, T["admin"])
s, d = call("POST", f"{S}/assign/", {"assignments": [{"question_id": qs[0], "responder_id": ID["priya"]}, {"question_id": qs[1], "responder_id": ID["priya"]}, {"question_id": qs[2], "responder_id": ID["kavya"]}, {"question_id": qs[3], "responder_id": ID["kavya"]}]}, T["admin"])
ok("assign two questions to a second respondent", s == 200 and [(q["responder"] or {}).get("id") for sec in d["sections"] for q in sec["questions"]] == [ID["priya"]] * 2 + [ID["kavya"]] * 2, (s, d))
ok("the reviewer can't also be a respondent", call("PATCH", f"{S}/", {"reviewer_id": ID["kavya"]}, T["admin"])[0] == 400)
s, d = call("POST", f"{S}/publish/", token=T["admin"])
ok("publish -> in progress", s == 200 and d["status"] == "in_progress" and d["respondents"][0]["stats"]["total"] == 2, (s, d))


def mine(who):
    return call("GET", f"{S}/", token=T[who])[1]


def ids_of(survey):
    return [q["id"] for sec in survey["sections"] for q in sec["questions"]]


ok("a respondent sees only their own questions", ids_of(mine("priya")) == qs[:2] and ids_of(mine("kavya")) == qs[2:])
ok("the reviewer sees nothing before anything is submitted", ids_of(mine("vikram")) == [])
ok("the approver sees nothing yet either", ids_of(mine("anita")) == [])
ok("an admin sees all four", ids_of(mine("admin")) == qs)

# ---- priya submits her two
s, d = call("POST", f"{S}/submit/", {"answers": {qs[0]: "a", qs[1]: "b"}, "question_ids": qs[:2]}, T["priya"])
ok("priya submits her questions; the survey stays in progress", s == 200 and d["status"] == "in_progress", (s, d))
ok("she can't submit kavya's question", call("POST", f"{S}/submit/", {"answers": {qs[2]: "x"}, "question_ids": [qs[2]]}, T["priya"])[0] == 400)
v = mine("vikram")
ok("the reviewer now sees exactly those two, with their answers", ids_of(v) == qs[:2] and v["answers"] == {qs[0]: "a", qs[1]: "b"}, v)
ok("kavya's questions are still hers alone", ids_of(mine("kavya")) == qs[2:] and mine("kavya")["answers"] == {})
ok("kavya can't see priya's answers in the activity log", all(h["question_ids"] == [] or set(h["question_ids"]) <= set(qs[2:]) for h in mine("kavya")["history"]))

# ---- reviewer passes one, returns one with a note
s, d = call("POST", f"{S}/review/", {"decision": "pass", "comment": "", "question_ids": [qs[0]]}, T["vikram"])
ok("the reviewer passes one question", s == 200 and d["question_stats"]["awaiting_approval"] == 1 and d["question_stats"]["awaiting_review"] == 1, (s, d))
ok("returning without a reason is refused", call("POST", f"{S}/review/", {"decision": "return", "comment": "", "question_ids": [qs[1]]}, T["vikram"])[0] == 400)
ok("a note on a question outside the decision is refused", call("POST", f"{S}/review/", {"decision": "return", "comment": "", "question_ids": [qs[1]], "question_comments": [{"question_id": qs[0], "text": "x"}]}, T["vikram"])[0] == 400)
s, d = call("POST", f"{S}/review/", {"decision": "return", "comment": "", "question_ids": [qs[1]], "question_comments": [{"question_id": qs[1], "text": "Be specific"}]}, T["vikram"])
ok("the reviewer returns the other with a note", s == 200 and d["question_stats"]["returned"] == 1, (s, d))
p = mine("priya")
ok("priya sees the note on her returned question", any(c["text"] == "Be specific" for h in p["history"] for c in h["question_comments"]))
ok("the approver sees only the question that passed review", ids_of(mine("anita")) == [qs[0]])

# ---- approve one: survey still in progress
s, d = call("POST", f"{S}/approve/", {"decision": "approve", "comment": "", "question_ids": [qs[0]]}, T["anita"])
ok("approving one of four leaves the survey in progress", s == 200 and d["status"] == "in_progress" and d["question_stats"]["approved"] == 1, (s, d))
ok("approving a question not yet reviewed is refused", call("POST", f"{S}/approve/", {"decision": "approve", "comment": "", "question_ids": [qs[1]]}, T["anita"])[0] == 400)

# ---- the rest
call("POST", f"{S}/submit/", {"answers": {qs[1]: "b2"}, "question_ids": [qs[1]]}, T["priya"])
call("POST", f"{S}/submit/", {"answers": {qs[2]: "c", qs[3]: "d"}}, T["kavya"])
call("POST", f"{S}/review/", {"decision": "pass", "comment": ""}, T["vikram"])
s, d = call("POST", f"{S}/approve/", {"decision": "approve", "comment": ""}, T["anita"])
ok("approving everything left makes the survey approved", s == 200 and d["status"] == "approved" and d["question_stats"]["approved"] == 4, (s, d))
tasks = call("GET", "/api/surveys/tasks/", token=T["priya"])[1]["results"]
ok("a finished survey is off everyone's task list", all(t["id"] != sv["id"] for t in tasks))
admin_view = mine("admin")
ok("the audit trail records each step against its questions", sum(1 for h in admin_view["history"] if h["action"] == "submitted") == 3 and all(h["question_ids"] for h in admin_view["history"] if h["action"] in ("submitted", "reviewed", "approved", "returned")))

print(f"{passed} passed, {failed} failed")
raise SystemExit(1 if failed else 0)
