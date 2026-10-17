"""
API smoke test: tenant isolation, permissions, validation, pagination and the
full survey workflow, against a live backend with the seeded abc and xyz
workspaces:

    make backend      # in one terminal
    make smoke        # in another

Repeatable: it creates uniquely-named records and deletes what it can.
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request

PORT = int(os.environ.get("API_PORT", "8000"))
UNIQ = str(int(time.time()))
NEW_EMAIL = f"new{UNIQ}@abc.localhost"
A, X = "abc.localhost", "xyz.localhost"
PASSWORD = "devpassword"
ZERO_ID = "00000000-0000-0000-0000-000000000000"

passed = failed = 0


def call(host, method, path, body=None, token=None):
    req = urllib.request.Request(
        f"http://127.0.0.1:{PORT}{path}",
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Host": f"{host}:{PORT}", "Content-Type": "application/json", **({"Authorization": f"Bearer {token}"} if token else {})},
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


def detail(body):
    return body.get("detail", "") if isinstance(body, dict) else str(body)


def login(host, email, password=PASSWORD):
    return call(host, "POST", "/api/auth/login/", {"email": email, "password": password})


def token_for(host, email, password=PASSWORD):
    status, body = login(host, email, password)
    assert status == 200, (host, email, status, body)
    return body["access"]


def results(host, path, token):
    """All rows of a paginated list."""
    sep = "&" if "?" in path else "?"
    status, body = call(host, "GET", f"{path}{sep}page_size=200", token=token)
    assert status == 200, (path, status, body)
    return body["results"] if isinstance(body, dict) else body


def by(rows, key, value):
    return next(r for r in rows if r[key] == value)


# =============================================================== platform
s, d = call("localhost", "GET", "/api/")
ok("platform host -> public schema", s == 200 and d["schema"] == "public")
ok("tenant routes absent on the public host", call("localhost", "GET", "/api/units/")[0] == 404)
ok("unknown subdomain -> 404", call("nope.localhost", "GET", "/api/")[0] == 404)
s, d = call("localhost", "GET", "/api/workspaces/lookup/?subdomain=abc")
ok("workspace lookup", s == 200 and d["name"] == "ABC Corporation")
ok("lookup of a missing workspace -> 404", call("localhost", "GET", "/api/workspaces/lookup/?subdomain=zzz")[0] == 404)
s, d = call(A, "GET", "/api/workspace/")
ok("workspace info is public on a tenant host", s == 200 and d["name"] == "ABC Corporation")

# ================================================================== auth
s, d = login(A, "admin@abc.localhost", "wrong")
ok("bad password -> 401 with a clean message", s == 401 and detail(d) == "Invalid email or password.", (s, d))
ok("login on the bare host is refused", login("localhost", "admin@abc.localhost")[0] in (400, 401, 403, 404))
s, d = login(X, "admin@abc.localhost")
ok("an abc user cannot sign in to xyz", s in (401, 403) and "access" in detail(d).lower(), (s, d))
adm = login(A, "admin@abc.localhost")[1]
tk = adm["access"]
ok("no token -> 401", call(A, "GET", "/api/units/")[0] == 401)
ok("an abc token is rejected on xyz", call(X, "GET", "/api/units/", token=tk)[0] in (401, 403))
s, me = call(A, "GET", "/api/auth/me/", token=tk)
ok("me", s == 200 and me["role"] == "admin" and me["email"] == "admin@abc.localhost" and me["tenant"]["subdomain"] == "abc", me)

# ============================================================== hierarchy
units = call(A, "GET", "/api/units/", token=tk)[1]
xtk = token_for(X, "admin@xyz.localhost")
xunits = call(X, "GET", "/api/units/", token=xtk)[1]
ok("the seeded organisation has 10 blocks", len(units) == 10, len(units))
ok("each block carries a member count and head", all("member_count" in u and "head" in u for u in units))
ok("tenants have disjoint ids", not ({u["id"] for u in units} & {u["id"] for u in xunits}))
root = next(u for u in units if u["parent_id"] is None)
ok("roots are named per tenant", root["name"] == "ABC Corporation" and next(u for u in xunits if u["parent_id"] is None)["name"] == "XYZ Industries")
eng, tech, web = by(units, "name", "Engineering"), by(units, "name", "Technology"), by(units, "name", "Web Team")

s, probe = call(A, "POST", "/api/units/", {"parent_id": root["id"], "name": "ISOLATION-PROBE " + UNIQ, "kind": "division"}, tk)
ok("create a block", s == 201 and probe["parent_id"] == root["id"], (s, probe))
ok("a block written in abc is invisible in xyz", all(u["name"] != "ISOLATION-PROBE " + UNIQ for u in call(X, "GET", "/api/units/", token=xtk)[1]))
ok("a second root is refused", call(A, "POST", "/api/units/", {"parent_id": None, "name": "R2", "kind": "organisation"}, tk)[0] == 400)
s, d = call(A, "PATCH", f"/api/units/{tech['id']}/", {"parent_id": web["id"]}, tk)
ok("moving a block under its own child is refused", s == 400 and "itself" in detail(d), d)
ok("a malformed parent id is a clean 400, not a crash", call(A, "POST", "/api/units/", {"parent_id": "nope", "name": "x", "kind": "team"}, tk)[0] == 400)
ok("an unknown block type is refused", call(A, "POST", "/api/units/", {"parent_id": root["id"], "name": "x", "kind": "galaxy"}, tk)[0] == 400)
ok("the root cannot be deleted", call(A, "DELETE", f"/api/units/{root['id']}/", token=tk)[0] == 400)
ok("a block with children cannot be deleted", call(A, "DELETE", f"/api/units/{tech['id']}/", token=tk)[0] == 400)
ok("a block that surveys target cannot be deleted", call(A, "DELETE", f"/api/units/{eng['id']}/", token=tk)[0] == 400)
ok("delete the probe block", call(A, "DELETE", f"/api/units/{probe['id']}/", token=tk)[0] == 204)

# ================================================ members and permissions
ntk = token_for(A, "neha@abc.localhost")
neha_id = call(A, "GET", "/api/auth/me/", token=ntk)[1]["id"]
ok("a member cannot create a block", call(A, "POST", "/api/units/", {"parent_id": root["id"], "name": "x", "kind": "team"}, ntk)[0] == 403)
ok("a member cannot create a survey", call(A, "POST", "/api/surveys/", {}, ntk)[0] == 403)
ok("a member cannot write a bank question", call(A, "POST", "/api/questions/", {"text": "x"}, ntk)[0] == 403)
ok("a member cannot edit workspace settings", call(A, "PUT", "/api/settings/workspace/", {"org_name": "x", "default_due_days": 3}, ntk)[0] == 403)
ok("a member cannot read the report summary", call(A, "GET", "/api/reports/summary/", token=ntk)[0] == 403)

users = results(A, "/api/users/", tk)
ok("ten people in abc (admin + 9)", len(users) >= 10, len(users))
ok("no password is ever returned", all("password" not in u for u in users))
s, page = call(A, "GET", "/api/users/?page_size=3", token=tk)
ok("pagination: count / next / results", s == 200 and page["count"] == len(users) and len(page["results"]) == 3 and page["next"], page)
ok("search by name", [u["full_name"] for u in results(A, "/api/users/?search=Vikram", tk)] == ["Vikram Singh"])
ok("filter by role", all(u["role"] == "admin" for u in results(A, "/api/users/?role=admin", tk)))
ok("filter by block", {u["email"] for u in results(A, f"/api/users/?unit={web['id']}", tk)} >= {"neha@abc.localhost", "arjun@abc.localhost"})
ok("order by name, descending", [u["full_name"] for u in results(A, "/api/users/?ordering=-user__full_name", tk)] == sorted([u["full_name"] for u in users], reverse=True))

s, d = call(A, "POST", "/api/users/", {"full_name": "New Hire", "email": NEW_EMAIL, "password": "short"}, tk)
ok("a short password is refused", s == 400, d)
s, nh = call(A, "POST", "/api/users/", {"full_name": "New Hire", "email": NEW_EMAIL, "password": "longenough1", "unit_id": web["id"], "title": "QA"}, tk)
ok("create a user", s == 201 and nh["unit"]["id"] == web["id"] and nh["title"] == "QA" and "password" not in nh, (s, nh))
ok("the new user can sign in to abc", login(A, NEW_EMAIL, "longenough1")[0] == 200)
ok("the new user cannot sign in to xyz", login(X, NEW_EMAIL, "longenough1")[0] != 200)
ok("a duplicate email is refused", call(A, "POST", "/api/users/", {"full_name": "D", "email": NEW_EMAIL.upper(), "password": "longenough1"}, tk)[0] == 400)
ok("a bad email is refused", call(A, "POST", "/api/users/", {"full_name": "D", "email": "not-an-email", "password": "longenough1"}, tk)[0] == 400)
s, d = call(A, "PATCH", f"/api/users/{nh['id']}/", {"title": "Lead", "is_active": False}, tk)
ok("edit and deactivate a user", s == 200 and d["title"] == "Lead" and d["is_active"] is False, d)
ok("a deactivated user is blocked at sign-in", login(A, NEW_EMAIL, "longenough1")[0] != 200)
ok("users cannot be deleted (deactivate instead)", call(A, "DELETE", f"/api/users/{nh['id']}/", token=tk)[0] == 405)
admin_row = next(u for u in users if u["role"] == "admin")
s, d = call(A, "PATCH", f"/api/users/{admin_row['id']}/", {"role": "member"}, tk)
ok("the last administrator cannot be demoted", s == 400 and "administrator" in detail(d), d)

# ============================================== question bank + categories
bcats = call(A, "GET", "/api/question-categories/", token=tk)[1]
ok("bank categories are seeded", len(bcats) >= 8)
ok("a member can read bank categories", call(A, "GET", "/api/question-categories/", token=ntk)[0] == 200)
ok("a member cannot create a bank category", call(A, "POST", "/api/question-categories/", {"label": "x"}, ntk)[0] == 403)
ok("a duplicate bank category is refused", call(A, "POST", "/api/question-categories/", {"label": bcats[0]["label"].upper()}, tk)[0] == 400)
s, bc = call(A, "POST", "/api/question-categories/", {"label": "Smoke " + UNIQ}, tk)
ok("create a bank category", s == 201 and bc["question_count"] == 0, (s, bc))
s, bc2 = call(A, "PUT", f"/api/question-categories/{bc['id']}/", {"label": "Smoke R " + UNIQ}, tk)
ok("rename a bank category", s == 200 and bc2["label"] == "Smoke R " + UNIQ)

bank = results(A, "/api/questions/", tk)
ok("seeded questions are present", len(bank) >= 9)
ok("filter bank by category", all(q["category"]["id"] == bcats[0]["id"] for q in results(A, f"/api/questions/?category={bcats[0]['id']}", tk)))
ok("filter bank by type", all(q["type"] == "rating" for q in results(A, "/api/questions/?type=rating", tk)))
ok("search the bank", all("collaboration" in q["text"].lower() for q in results(A, "/api/questions/?search=collaboration", tk)))
cat0 = bcats[0]["id"]
for name, body in {
    "a choice question needs two options": {"text": "q", "type": "single_choice", "options": ["a"], "category_id": cat0},
    "options must differ": {"text": "q", "type": "single_choice", "options": ["a", "a"], "category_id": cat0},
    "a question needs a category": {"text": "q", "type": "yes_no"},
    "an unknown type is refused": {"text": "q", "type": "nope", "category_id": cat0},
    "blank text is refused": {"text": "  ", "type": "text", "category_id": cat0},
}.items():
    ok(name, call(A, "POST", "/api/questions/", body, tk)[0] == 400)
s, q = call(A, "POST", "/api/questions/", {"text": "New Q", "type": "date", "hint": "pick", "category_id": bc["id"]}, tk)
ok("create a question", s == 201 and q["category"]["label"] == "Smoke R " + UNIQ and q["hint"] == "pick", (s, q))
ok("a bank category that has questions cannot be deleted", call(A, "DELETE", f"/api/question-categories/{bc['id']}/", token=tk)[0] == 400)
ok("delete the question", call(A, "DELETE", f"/api/questions/{q['id']}/", token=tk)[0] == 204)
ok("delete the now-empty bank category", call(A, "DELETE", f"/api/question-categories/{bc['id']}/", token=tk)[0] == 204)

# ========================================================= survey categories
scats = call(A, "GET", "/api/survey-categories/", token=tk)[1]
ok("seven survey categories are seeded", len(scats) >= 7, scats)
ok("a member can read survey categories", call(A, "GET", "/api/survey-categories/", token=ntk)[0] == 200)
ok("a member cannot create one", call(A, "POST", "/api/survey-categories/", {"label": "x"}, ntk)[0] == 403)
ok("a duplicate name is refused", call(A, "POST", "/api/survey-categories/", {"label": scats[0]["label"]}, tk)[0] == 400)
ok("a bad colour is refused", call(A, "POST", "/api/survey-categories/", {"label": "C " + UNIQ, "color": "pink"}, tk)[0] == 400)
s, sc = call(A, "POST", "/api/survey-categories/", {"label": "Smoke Cat " + UNIQ, "color": "rust"}, tk)
ok("create a survey category", s == 201 and sc["color"] == "rust" and sc["is_active"] and sc["code"].startswith("smoke-cat"), (s, sc))
s, d = call(A, "PATCH", f"/api/survey-categories/{sc['id']}/", {"is_active": False}, tk)
ok("switch a category off", s == 200 and d["is_active"] is False)
ok("a survey cannot start in a switched-off category", call(A, "POST", "/api/surveys/", {"title": "x", "category_id": sc["id"], "target_unit_id": eng["id"]}, tk)[0] == 400)
ok("delete an unused survey category", call(A, "DELETE", f"/api/survey-categories/{sc['id']}/", token=tk)[0] == 204)
cat_eng = next(c for c in scats if c["code"] == "engagement")

# ===================================================== the builder: a draft
people = {k: next(u for u in users if u["email"].startswith(k + "@"))["id"] for k in ("neha", "vikram", "anita")}
good = {"title": "T", "category_id": cat_eng["id"], "target_unit_id": eng["id"]}
ok("a title is required", call(A, "POST", "/api/surveys/", {**good, "title": " "}, tk)[0] == 400)
ok("a category is required", call(A, "POST", "/api/surveys/", {"title": "x", "target_unit_id": eng["id"]}, tk)[0] == 400)
ok("a bad block id is refused", call(A, "POST", "/api/surveys/", {**good, "target_unit_id": "nope"}, tk)[0] == 400)
s, sv = call(A, "POST", "/api/surveys/", {**good, "title": "API Survey " + UNIQ, "description": "d"}, tk)
ok("create a draft", s == 201 and sv["status"] == "draft" and len(sv["sections"]) == 1 and sv["category"]["label"] == "Employee Engagement" and sv["created_by"]["email"] == "admin@abc.localhost", (s, sv))
sid = sv["id"]
sec1 = sv["sections"][0]["id"]
S = f"/api/surveys/{sid}"
ok("a draft is hidden from members", call(A, "GET", f"{S}/", token=ntk)[0] == 404 and all(x["id"] != sid for x in results(A, "/api/surveys/", ntk)))
s, d = call(A, "POST", f"{S}/publish/", {}, tk)
ok("an empty draft can't publish", s == 400 and "question" in detail(d).lower(), d)

bank_rating = next(x for x in bank if x["type"] == "rating")
bank_text = next(x for x in bank if x["type"] == "text")
s, q1 = call(A, "POST", f"{S}/sections/{sec1}/questions/", {"bank_question_id": bank_rating["id"]}, tk)
ok("add a question from the bank", s == 201 and q1["bank_question_id"] == bank_rating["id"] and q1["text"] == bank_rating["text"], (s, q1))
ok("a missing bank question is a 404", call(A, "POST", f"{S}/sections/{sec1}/questions/", {"bank_question_id": ZERO_ID}, tk)[0] == 404)
s, sec2 = call(A, "POST", f"{S}/sections/", {"title": "Second", "description": "more"}, tk)
ok("add a section", s == 201 and sec2["title"] == "Second" and sec2["order"] == 1, (s, sec2))
ok("a section needs a title", call(A, "POST", f"{S}/sections/", {"title": " "}, tk)[0] == 400)
SEC2 = f"{S}/sections/{sec2['id']}"
s, q2 = call(A, "POST", f"{SEC2}/questions/", {"text": "Pick some", "type": "multi_choice", "options": ["A", "B", "C"], "hint": "any", "required": False}, tk)
ok("write a new question", s == 201 and q2["required"] is False and q2["bank_question_id"] is None, (s, q2))
s, q3 = call(A, "POST", f"{SEC2}/questions/", {"bank_question_id": bank_text["id"]}, tk)
s, d = call(A, "PATCH", f"{SEC2}/questions/{q2['id']}/", {"text": "Pick several", "options": ["A", "B", "C", "D"]}, tk)
ok("edit a question (partial)", s == 200 and d["text"] == "Pick several" and len(d["options"]) == 4 and d["type"] == "multi_choice", (s, d))
s, d = call(A, "POST", f"{SEC2}/questions/{q3['id']}/move/", {"direction": "up"}, tk)
got = call(A, "GET", f"{S}/", token=tk)[1]
ok("move a question up", s == 204 and [x["id"] for x in got["sections"][1]["questions"]] == [q3["id"], q2["id"]])
s, d = call(A, "POST", f"{SEC2}/move/", {"direction": "up"}, tk)
got = call(A, "GET", f"{S}/", token=tk)[1]
ok("move a section up", s == 204 and got["sections"][0]["id"] == sec2["id"])
call(A, "POST", f"{SEC2}/move/", {"direction": "down"}, tk)
ok("a bad direction is refused", call(A, "POST", f"{SEC2}/questions/{q3['id']}/move/", {"direction": "sideways"}, tk)[0] == 400)
ok("delete a section while others remain", call(A, "DELETE", f"{S}/sections/{sec1}/", token=tk)[0] == 204)
got = call(A, "GET", f"{S}/", token=tk)[1]
ok("a survey keeps at least one section", call(A, "DELETE", f"{S}/sections/{got['sections'][0]['id']}/", token=tk)[0] == 400)
remaining = got["sections"][0]["id"]
s, q1 = call(A, "POST", f"{S}/sections/{remaining}/questions/", {"bank_question_id": bank_rating["id"]}, tk)
got = call(A, "GET", f"{S}/", token=tk)[1]
ok("readiness lists what is missing", [r["key"] for r in got["readiness"] if not r["ok"]] == ["people", "distinct"], got["readiness"])
s, d = call(A, "POST", f"{S}/publish/", {}, tk)
ok("can't publish without three people", s == 400 and "needed" in detail(d), d)
ok("duplicate roles are refused", call(A, "PATCH", f"{S}/", {"responder_id": people["neha"], "reviewer_id": people["neha"]}, tk)[0] == 400)
ok("a malformed person id is refused", call(A, "PATCH", f"{S}/", {"responder_id": "nope"}, tk)[0] == 400)
ok("an unknown person is refused", call(A, "PATCH", f"{S}/", {"responder_id": ZERO_ID}, tk)[0] == 400)
s, d = call(A, "PATCH", f"{S}/", {"title": "API Survey " + UNIQ + "!", "instructions": "Be honest", "responder_id": people["neha"], "reviewer_id": people["vikram"], "approver_id": people["anita"], "due_date": "2030-01-31"}, tk)
ok("assign three people, instructions and a due date", s == 200 and d["responder"]["id"] == people["neha"] and d["instructions"] == "Be honest" and d["due_date"] == "2030-01-31", (s, d))
ok("a bad due date is refused", call(A, "PATCH", f"{S}/", {"due_date": "31/01/2030"}, tk)[0] == 400)
ok("the draft is ready to publish", all(r["ok"] for r in d["readiness"]))
ok("a member cannot publish", call(A, "POST", f"{S}/publish/", {}, ntk)[0] in (403, 404))
s, d = call(A, "POST", f"{S}/publish/", {}, tk)
ok("publish", s == 200 and d["status"] == "awaiting_response" and d["published_at"] and d["readiness"] == [], (s, d))
ok("publishing twice is refused", call(A, "POST", f"{S}/publish/", {}, tk)[0] == 400)

# ----------------------------------------------------------- frozen once live
ok("frozen: can't add a section", call(A, "POST", f"{S}/sections/", {"title": "x"}, tk)[0] == 400)
ok("frozen: can't add a question", call(A, "POST", f"{S}/sections/{remaining}/questions/", {"text": "x", "type": "text"}, tk)[0] == 400)
ok("frozen: can't edit a question", call(A, "PATCH", f"{S}/sections/{remaining}/questions/{q1['id']}/", {"text": "x"}, tk)[0] == 400)
ok("frozen: can't delete a question", call(A, "DELETE", f"{S}/sections/{remaining}/questions/{q1['id']}/", token=tk)[0] == 400)
ok("frozen: can't retitle", call(A, "PATCH", f"{S}/", {"title": "nope"}, tk)[0] == 400)
s, d = call(A, "PATCH", f"{S}/", {"due_date": "2031-02-02"}, tk)
ok("live: the due date can still change", s == 200 and d["due_date"] == "2031-02-02")
ok("live: a person cannot be removed", call(A, "PATCH", f"{S}/", {"approver_id": None}, tk)[0] == 400)

# ------------------------------------------------------------- visibility
mine = results(A, "/api/surveys/", ntk)
ok("the published survey shows for its responder", any(x["id"] == sid for x in mine))
ok("members see no drafts and only their own surveys", all(x["status"] != "draft" for x in mine) and all(neha_id in (x["responder"] and x["responder"]["id"], x["reviewer"] and x["reviewer"]["id"], x["approver"] and x["approver"]["id"]) for x in mine))
allsv = results(A, "/api/surveys/", tk)
ok("an admin sees everything, drafts included", any(x["status"] == "draft" for x in allsv) and len(allsv) >= 5)
ok("filter surveys by status", all(x["status"] == "draft" for x in results(A, "/api/surveys/?status=draft", tk)))
ok("filter surveys by category", all(x["category"]["id"] == cat_eng["id"] for x in results(A, f"/api/surveys/?category={cat_eng['id']}", tk)))
ok("filter surveys by block", all(x["target_unit"]["id"] == eng["id"] for x in results(A, f"/api/surveys/?target_unit={eng['id']}", tk)))
ok("search surveys", [x["title"] for x in results(A, "/api/surveys/?search=Operations", tk)] == ["Operations Process Review"])
ok("order surveys by title", [x["title"] for x in results(A, "/api/surveys/?ordering=title", tk)] == sorted(x["title"] for x in allsv))
ops = next(x for x in allsv if x["title"].startswith("Operations"))
ok("a member can't open an uninvolved survey", call(A, "GET", f"/api/surveys/{ops['id']}/", token=ntk)[0] == 404)
ok("a malformed survey id is a clean 404", call(A, "GET", "/api/surveys/nope/", token=tk)[0] == 404)

# ------------------------------------------------------- tasks and my_task
s, tasks = call(A, "GET", "/api/surveys/tasks/", token=ntk)
mine_task = next((x for x in tasks["results"] if x["id"] == sid), None)
ok("the tasks inbox lists the survey for its responder", s == 200 and mine_task and mine_task["my_task"] == {"role": "responder", "action": "Respond"}, tasks)
ok("an admin who has no part sees no task for it", all(x["id"] != sid for x in results(A, "/api/surveys/tasks/", tk)))

# ----------------------------------------------- workflow + answer validation
vtk, atk = token_for(A, "vikram@abc.localhost"), token_for(A, "anita@abc.localhost")
RQ = q1["id"]
TXT = {q3["id"]: "Tooling"}  # the survey also has a required text question
submit = lambda token, answers: call(A, "POST", f"{S}/submit/", {"answers": answers}, token)

# ---- who is holding it up, deadlines, and saved drafts
s, cur = call(A, "GET", f"{S}/", token=tk)
ok("waiting_on names the respondent while awaiting a response", cur["waiting_on"]["role"] == "responder" and cur["waiting_on"]["person"]["id"] == people["neha"], cur["waiting_on"])
ok("stage_since is a timestamp", "T" in cur["stage_since"])
ok("a survey due in the future is not overdue", cur["is_overdue"] is False)
call(A, "PATCH", f"{S}/", {"due_date": "2020-01-01"}, tk)
s, od = call(A, "GET", f"{S}/", token=tk)
ok("a live survey past its due date is overdue", od["is_overdue"] is True)
ok("?overdue=true lists it", any(x["id"] == sid for x in results(A, "/api/surveys/?overdue=true", tk)))
ok("?overdue=true lists only overdue surveys", all(x["is_overdue"] for x in results(A, "/api/surveys/?overdue=true", tk)))
ok("?in_progress=true lists only surveys awaiting someone", all(x["status"] in ("awaiting_response", "awaiting_review", "awaiting_approval") for x in results(A, "/api/surveys/?in_progress=true", tk)) and results(A, "/api/surveys/?in_progress=true", tk))
ok("the dashboard counts it as overdue", call(A, "GET", "/api/reports/dashboard/", token=tk)[1]["counts"]["overdue"] >= 1)
call(A, "PATCH", f"{S}/", {"due_date": "2031-02-02"}, tk)

DRAFT = {RQ: 3}
ok("only the respondent can save a draft", call(A, "POST", f"{S}/save-draft/", {"answers": DRAFT}, vtk)[0] in (400, 403, 404))
s, d = call(A, "POST", f"{S}/save-draft/", {"answers": DRAFT}, ntk)
ok("the respondent saves a draft", s == 200 and d["draft_answers"] == {RQ: 3}, d["draft_answers"])
ok("a draft does not touch the submitted answers", d["answers"] == {} and d["status"] == "awaiting_response")
ok("a draft is private to the responder", call(A, "GET", f"{S}/", token=tk)[1]["draft_answers"] == {} and call(A, "GET", f"{S}/", token=vtk)[1]["draft_answers"] == {})
ok("a draft is restored for the responder", call(A, "GET", f"{S}/", token=ntk)[1]["draft_answers"] == DRAFT)
ok("a draft may be incomplete", call(A, "POST", f"{S}/save-draft/", {"answers": {}}, ntk)[0] == 200)
ok("a draft answer must still be valid", call(A, "POST", f"{S}/save-draft/", {"answers": {RQ: 9}}, ntk)[0] == 400)
ok("unknown ids in a draft are dropped", call(A, "POST", f"{S}/save-draft/", {"answers": {"junk": "x", RQ: 2}}, ntk)[1]["draft_answers"] == {RQ: 2})

ok("the reviewer cannot submit", submit(vtk, {**TXT, RQ: 4})[0] == 400)
ok("the reviewer is too early", call(A, "POST", f"{S}/review/", {"decision": "pass"}, vtk)[0] == 400)
ok("a missing required answer is refused", submit(ntk, {})[0] == 400)
for bad in (0, 6, "4", 4.5, True):
    ok(f"rating {bad!r} is refused", submit(ntk, {**TXT, RQ: bad})[0] == 400)
s, d = submit(ntk, {**TXT, RQ: 4, "junk-id": "x"})
ok("submit -> awaiting_review", s == 200 and d["status"] == "awaiting_review", (s, d))
ok("unknown answer keys are dropped", "junk-id" not in d["answers"] and d["answers"][RQ] == 4)
ok("submitting clears the saved draft", call(A, "GET", f"{S}/", token=ntk)[1]["draft_answers"] == {})
ok("waiting_on moves to the reviewer after submit", d["waiting_on"]["role"] == "reviewer" and d["waiting_on"]["person"]["id"] == people["vikram"], d["waiting_on"])
ok("a draft can no longer be saved once submitted", call(A, "POST", f"{S}/save-draft/", {"answers": {RQ: 1}}, ntk)[0] == 400)
ok("a second submit is refused", submit(ntk, {**TXT, RQ: 4})[0] == 400)
ok("returning needs a comment", call(A, "POST", f"{S}/review/", {"decision": "return", "comment": " "}, vtk)[0] == 400)
ok("an unknown decision is refused", call(A, "POST", f"{S}/review/", {"decision": "maybe"}, vtk)[0] == 400)
s, d = call(A, "POST", f"{S}/review/", {"decision": "return", "comment": "Fix"}, vtk)
ok("the reviewer returns it", s == 200 and d["status"] == "returned" and d["history"][-1]["comment"] == "Fix" and d["history"][-1]["by"]["full_name"] == "Vikram Singh")
submit(ntk, {**TXT, RQ: 5})
s, d = call(A, "POST", f"{S}/review/", {"decision": "pass", "comment": "ok"}, vtk)
ok("pass -> awaiting_approval", d["status"] == "awaiting_approval")
ok("the approver's return needs a comment", call(A, "POST", f"{S}/approve/", {"decision": "return"}, atk)[0] == 400)
call(A, "POST", f"{S}/approve/", {"decision": "return", "comment": "redo"}, atk)
submit(ntk, {**TXT, RQ: 5})
call(A, "POST", f"{S}/review/", {"decision": "pass"}, vtk)
s, d = call(A, "POST", f"{S}/approve/", {"decision": "approve"}, atk)
ok("approved", d["status"] == "approved")
ok("an approved survey is waiting on no one", d["waiting_on"] is None and d["is_overdue"] is False)
acts = [h["action"] for h in d["history"]]
ok("the activity log is complete", acts == ["created", "published", "submitted", "returned", "submitted", "reviewed", "returned", "submitted", "reviewed", "approved"], acts)
ok("nothing can happen after approval", call(A, "POST", f"{S}/approve/", {"decision": "approve"}, atk)[0] == 400)
ok("an approved survey can't be edited", call(A, "PATCH", f"{S}/", {"due_date": "2032-01-01"}, tk)[0] == 400)
ok("an approved survey can't be closed", call(A, "POST", f"{S}/close/", {}, tk)[0] == 400)

# ------------------------------------------------- duplicate, close, delete
s, dup = call(A, "POST", f"{S}/duplicate/", {}, tk)
ok("duplicate -> an editable draft with the same questions", s == 201 and dup["status"] == "draft" and dup["title"].startswith("Copy of") and dup["question_count"] == d["question_count"] and dup["answers"] == {}, (s, dup))
ok("a member cannot duplicate", call(A, "POST", f"{S}/duplicate/", {}, ntk)[0] in (403, 404))
s, d2 = call(A, "POST", f"/api/surveys/{dup['id']}/publish/", {}, tk)
ok("the duplicate publishes (the people were copied)", s == 200 and d2["status"] == "awaiting_response", d2)
s, d3 = call(A, "POST", f"/api/surveys/{dup['id']}/close/", {"comment": "Not needed"}, tk)
ok("close a live survey", s == 200 and d3["status"] == "closed" and d3["history"][-1]["comment"] == "Not needed", d3)
ok("a closed survey can't be submitted", call(A, "POST", f"/api/surveys/{dup['id']}/submit/", {"answers": {}}, ntk)[0] == 400)
ok("a member cannot close", call(A, "POST", f"/api/surveys/{dup['id']}/close/", {}, ntk)[0] in (403, 404))
ok("a category in use cannot be deleted", call(A, "DELETE", f"/api/survey-categories/{cat_eng['id']}/", token=tk)[0] == 400)
ok("delete the survey", call(A, "DELETE", f"{S}/", token=tk)[0] == 204)
ok("delete the duplicate", call(A, "DELETE", f"/api/surveys/{dup['id']}/", token=tk)[0] == 204)

# ================================================================= reports
s, dash = call(A, "GET", "/api/reports/dashboard/", token=tk)
c = dash["counts"]
ok("dashboard counts for an admin", s == 200 and c["surveys"] >= 4 and c["drafts"] >= 1 and c["approved"] >= 1 and c["in_progress"] >= 3, dash)
ok("dashboard by_unit rolls up through the hierarchy", by(dash["by_unit"], "name", "ABC Corporation")["total"] >= by(dash["by_unit"], "name", "Operations")["total"] >= 1)
s, mdash = call(A, "GET", "/api/reports/dashboard/", token=ntk)
ok("a member's dashboard is scoped to them (and has no drafts)", s == 200 and mdash["counts"]["drafts"] == 0 and mdash["counts"]["surveys"] < c["surveys"], mdash)
s, rep = call(A, "GET", "/api/reports/summary/", token=tk)
ok("report summary: statuses, blocks, categories", s == 200 and len(rep["by_status"]) == 6 and rep["by_unit"] and any(r["label"] == "Employee Engagement" for r in rep["by_category"]), rep)

# ====================================================== settings and profile
s, st = call(A, "GET", "/api/settings/workspace/", token=tk)
ok("workspace settings", s == 200 and st["org_name"] == "ABC Corporation" and st["default_due_days"] == 14, st)
s, st = call(A, "PUT", "/api/settings/workspace/", {"org_name": "ABC Corp", "default_due_days": 10}, tk)
ok("update workspace settings", s == 200 and st["org_name"] == "ABC Corp")
ok("invalid settings are refused", call(A, "PUT", "/api/settings/workspace/", {"org_name": "x", "default_due_days": 0}, tk)[0] == 400)
ok("settings are scoped per workspace", call(X, "GET", "/api/settings/workspace/", token=xtk)[1]["org_name"] == "XYZ Industries")
call(A, "PUT", "/api/settings/workspace/", {"org_name": "ABC Corporation", "default_due_days": 14}, tk)

s, d = call(A, "PATCH", "/api/auth/me/", {"full_name": "Neha G", "title": "Lead!"}, ntk)
ok("update my profile", s == 200 and d["full_name"] == "Neha G" and d["title"] == "Lead!", d)
call(A, "PATCH", "/api/auth/me/", {"full_name": "Neha Gupta", "title": "Web Team Lead"}, ntk)
ok("wrong current password", call(A, "POST", "/api/auth/change-password/", {"current_password": "bad", "new_password": "newpassword1"}, ntk)[0] == 400)
ok("a short new password", call(A, "POST", "/api/auth/change-password/", {"current_password": PASSWORD, "new_password": "123"}, ntk)[0] == 400)
ok("change my password", call(A, "POST", "/api/auth/change-password/", {"current_password": PASSWORD, "new_password": "newpassword1"}, ntk)[0] == 200)
ok("sign in with the new password", login(A, "neha@abc.localhost", "newpassword1")[0] == 200)
call(A, "POST", "/api/auth/change-password/", {"current_password": "newpassword1", "new_password": PASSWORD}, ntk)

# ============================================== isolation of the new data
s, xc = call(X, "POST", "/api/survey-categories/", {"label": "XYZ only " + UNIQ}, xtk)
ok("a category made in xyz is invisible in abc", all(c["label"] != "XYZ only " + UNIQ for c in call(A, "GET", "/api/survey-categories/", token=tk)[1]))
call(X, "DELETE", f"/api/survey-categories/{xc['id']}/", token=xtk)
ok("xyz keeps its own surveys", len(results(X, "/api/surveys/", xtk)) >= 5 and all(x["id"] not in {y["id"] for y in allsv} for x in results(X, "/api/surveys/", xtk)))

# ============================================================ token lifecycle
s, r = call(A, "POST", "/api/auth/refresh/", {"refresh": adm["refresh"]})
ok("refresh works", s == 200 and "access" in r, (s, r))
ok("logout", call(A, "POST", "/api/auth/logout/", {"refresh": adm["refresh"]})[0] == 204)
ok("a blacklisted refresh token is refused", call(A, "POST", "/api/auth/refresh/", {"refresh": adm["refresh"]})[0] == 401)

print(f"\n{passed} passed, {failed} failed")
sys.exit(1 if failed else 0)
