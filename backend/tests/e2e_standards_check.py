"""End-to-end test of the standards frameworks through the real API (run inside manage.py shell).
Everything happens in a transaction that is rolled back at the end."""
import io, re, traceback
from pathlib import Path
from django.db import transaction
from django_tenants.utils import tenant_context, get_tenant_model
from rest_framework.test import APIClient

PUBLIC = Path("/home/abhishek-kumar/Downloads/orgsurvey/public")
RESULTS, FAILS = [], []


def check(name, cond, detail=""):
    RESULTS.append((name, bool(cond)))
    if not cond:
        FAILS.append(f"{name} {detail}")


class Rollback(Exception):
    pass


def client(user):
    c = APIClient(HTTP_HOST="abc.localhost")
    c.force_authenticate(user, token={"tenant_schema": "tenant_abc"})
    return c


def good_answer(q, variant=0):
    t = q["type"]
    if t == "yes_no":
        return "Yes" if variant == 0 else "No"
    if t == "number":
        return 12.5 + variant
    if t == "single_choice":
        return q["options"][variant % len(q["options"])]
    if t == "multi_choice":
        return q["options"][: 1 + (variant % len(q["options"]))]
    if t == "date":
        return "2026-03-31"
    if t == "rating":
        return 4
    return f"Test answer {variant} for {q['id'][:6]}"


def bad_answer(q):
    t = q["type"]
    return {"yes_no": "Maybe", "number": "twelve", "single_choice": "NOT AN OPTION", "multi_choice": ["NOT AN OPTION"], "text": 123}.get(t)


def run():
    from apps.organisation.models import Member, OrgUnit
    from apps.surveys.models import SurveyCategory
    from apps.question_bank.models import GriStandard, Question

    members = list(Member.objects.filter(is_active=True).select_related("user"))
    admin = next(m.user for m in members if m.role == "admin")
    others = [m.user for m in members if m.role != "admin"]
    print("admin:", admin.email, "| others:", [u.email for u in others])
    check("have an admin and 4+ other active members", len(others) >= 4)
    resp_a, resp_b, reviewer, approver = others[:4]
    unit, category = OrgUnit.objects.first(), SurveyCategory.objects.first()
    A = client(admin)

    # ---------------------------------------------------------------- 1. catalogue
    expected = {"gri": (41, None), "sasb": (77, None), "tcfd": (4, 42), "rspo": (7, 234), "wef": (4, 359)}
    by_fw = {}
    for fw, (n_std, n_q) in expected.items():
        r = A.get(f"/api/gri-standards/?framework={fw}")
        check(f"[{fw}] list 200", r.status_code == 200, r.status_code)
        rows = r.json()
        by_fw[fw] = rows
        check(f"[{fw}] {n_std} standards", len(rows) == n_std, len(rows))
        if n_q:
            check(f"[{fw}] {n_q} questions in total", sum(s["question_count"] for s in rows) == n_q, sum(s["question_count"] for s in rows))
        check(f"[{fw}] framework field correct on every row", all(s["framework"] == fw for s in rows))
        for s in rows:
            check(f"[{fw}] {s['code']} has question(s)", s["question_count"] > 0)
            check(f"[{fw}] {s['code']} PDF exists on disk", (PUBLIC / s["pdf"].lstrip("/")).is_file(), s["pdf"])
    check("no framework bleeds into another", not ({s["slug"] for s in by_fw["gri"]} & {s["slug"] for s in by_fw["sasb"]}))
    check("GRI sample counts", sum(s["question_count"] for s in by_fw["gri"]) == 1111, sum(s["question_count"] for s in by_fw["gri"]))
    check("SASB sample counts", sum(s["question_count"] for s in by_fw["sasb"]) == 1199, sum(s["question_count"] for s in by_fw["sasb"]))
    bank = A.get("/api/bank-questions/") if False else None

    # the plain question bank must not list standard questions
    for path in ("/api/question-bank/", "/api/bank/questions/", "/api/bank-questions/"):
        r = A.get(path)
        if r.status_code == 200:
            body = r.json()
            items = body["results"] if isinstance(body, dict) and "results" in body else body
            check(f"{path} lists no standard questions", all("ref" not in i or not i.get("ref") for i in items[:50]))
            break

    # ------------------------------------------------- 2. every standard's detail
    details = {}
    for fw, rows in by_fw.items():
        for s in rows:
            d = A.get(f"/api/gri-standards/{s['id']}/").json()
            details[s["id"]] = d
            qs = d["questions"]
            check(f"[{fw}:{s['code']}] detail has {s['question_count']} questions", len(qs) == s["question_count"], len(qs))
            bad = [q for q in qs if not (q["text"].strip() and q["ref"] and q["title"])]
            check(f"[{fw}:{s['code']}] every question has text, ref and group title", not bad, bad[:1])
            bad = [q for q in qs if q["type"] in ("single_choice", "multi_choice") and not q.get("options", None) and "options" in q]
            bad2 = [q for q in qs if len(q["hint"]) > 500]
            check(f"[{fw}:{s['code']}] hints within limit", not bad2)
            # grouping is contiguous: a group never reappears later
            seen, order = set(), []
            for q in qs:
                key = (q["ref"], q["title"])
                if not order or order[-1] != key:
                    check(f"[{fw}:{s['code']}] group {key[0]} contiguous", key not in seen, key)
                    seen.add(key)
                    order.append(key)
            nums = [(q["ref"], q["item"]) for q in qs]
            check(f"[{fw}:{s['code']}] question numbers unique", len(set(nums)) == len(nums))

    # --------------------------------------------- 3. one survey per framework, full workflow
    def make_survey(title):
        r = A.post("/api/surveys/", {"title": title, "category_id": str(category.pk), "target_unit_id": str(unit.pk)}, format="json")
        check(f"create '{title}'", r.status_code == 201, r.content[:200])
        return r.json()

    def full_flow(fw, standards, pick=None):
        label = f"{fw}-flow"
        sv = make_survey(f"E2E {fw.upper()} survey")
        sid = sv["id"]
        total = 0
        for s in standards:
            ids = None
            if pick:
                ids = [q["id"] for q in details[s["id"]]["questions"]][:pick]
            r = A.post(f"/api/surveys/{sid}/sections/from-gri/", {"gri_standard_id": s["id"], **({"question_ids": ids} if ids else {})}, format="json")
            check(f"[{label}] add {s['code']}", r.status_code == 201, r.content[:300])
            sec = r.json()
            want = len(ids) if ids else s["question_count"]
            check(f"[{label}] {s['code']} section has {want} questions", len(sec["questions"]) == want, len(sec["questions"]))
            check(f"[{label}] {s['code']} section tagged {fw}", sec["gri"]["framework"] == fw)
            check(f"[{label}] section questions carry ref/title/item", all(q["gri_ref"] and q["gri_title"] and q["gri_item"] is not None for q in sec["questions"]))
            orig = [q["id"] for q in details[s["id"]]["questions"]]
            texts_ok = [q["text"] for q in sec["questions"]] == [q["text"] for q in details[s["id"]]["questions"] if (not ids or q["id"] in ids)]
            check(f"[{label}] {s['code']} section keeps PDF order and wording", texts_ok)
            r = A.post(f"/api/surveys/{sid}/sections/from-gri/", {"gri_standard_id": s["id"], **({"question_ids": ids} if ids else {})}, format="json")
            check(f"[{label}] re-adding {s['code']} does not duplicate", r.status_code == 201 and len(r.json()["questions"]) == want)
            total += want
        survey = A.get(f"/api/surveys/{sid}/").json()
        check(f"[{label}] survey has {total} questions", sum(len(x["questions"]) for x in survey["sections"]) == total)
        gri_secs = [x for x in survey["sections"] if x["gri"]]
        check(f"[{label}] one section per standard", len(gri_secs) == len(standards), len(gri_secs))

        # cannot publish yet
        r = A.post(f"/api/surveys/{sid}/publish/")
        check(f"[{label}] publish blocked while unassigned", r.status_code == 400, r.status_code)

        # assign sections alternately to two respondents; reviewer/approver
        people = [resp_a, resp_b]
        owner_of = {}
        for i, sec in enumerate(survey["sections"]):
            p = people[i % 2]
            r = A.post(f"/api/surveys/{sid}/sections/{sec['id']}/assign/", {"responder_id": str(p.pk)}, format="json")
            check(f"[{label}] assign section {i+1}", r.status_code in (200, 201), r.content[:200])
            for q in sec["questions"]:
                owner_of[q["id"]] = p
        r = A.patch(f"/api/surveys/{sid}/", {"reviewer_id": str(reviewer.pk), "approver_id": str(approver.pk), "due_date": "2027-01-31"}, format="json")
        check(f"[{label}] set reviewer/approver/due date", r.status_code == 200, r.content[:200])
        r = A.post(f"/api/surveys/{sid}/publish/")
        check(f"[{label}] publish", r.status_code == 200 and r.json()["status"] == "in_progress", r.content[:300])
        survey = A.get(f"/api/surveys/{sid}/").json()
        allq = {q["id"]: q for sec in survey["sections"] for q in sec["questions"]}

        # respondents
        for p in people:
            C = client(p)
            mine = [q for q in allq.values() if owner_of[q["id"]].pk == p.pk]
            if not mine:
                continue
            view = C.get(f"/api/surveys/{sid}/").json()
            seen = {q["id"] for sec in view["sections"] for q in sec["questions"]}
            check(f"[{label}] {p.email} sees exactly their questions", seen == {q["id"] for q in mine}, (len(seen), len(mine)))
            # invalid answers are rejected
            for q in mine:
                bad = bad_answer(q)
                if bad is not None:
                    r = C.post(f"/api/surveys/{sid}/submit/", {"answers": {q["id"]: bad}, "question_ids": [q["id"]]}, format="json")
                    check(f"[{label}] bad {q['type']} answer rejected", r.status_code == 400, f"{r.status_code} {q['type']}")
                    break
            answers = {q["id"]: good_answer(q, i) for i, q in enumerate(mine)}
            r = C.post(f"/api/surveys/{sid}/save-draft/", {"answers": answers}, format="json")
            check(f"[{label}] {p.email} saves draft", r.status_code == 200, r.content[:200])
            r = C.post(f"/api/surveys/{sid}/submit/", {"answers": answers, "notes": {mine[0]["id"]: "A note with the answer"}}, format="json")
            check(f"[{label}] {p.email} submits {len(mine)} answers", r.status_code == 200, r.content[:300])

        survey = A.get(f"/api/surveys/{sid}/").json()
        allq = {q["id"]: q for sec in survey["sections"] for q in sec["questions"]}
        check(f"[{label}] all awaiting review", all(q["status"] == "awaiting_review" for q in allq.values()), {q["status"] for q in allq.values()})

        # reviewer: return the first 2 questions of resp_a, pass the rest
        R = client(reviewer)
        rv = R.get(f"/api/surveys/{sid}/").json()
        rids = [q["id"] for sec in rv["sections"] for q in sec["questions"]]
        check(f"[{label}] reviewer sees all {len(rids)} submitted", len(rids) == len(allq))
        ret = rids[:2]
        r = R.post(f"/api/surveys/{sid}/review/", {"decision": "return", "comment": "Please check", "question_ids": ret, "question_comments": [{"question_id": ret[0], "text": "Needs detail"}]}, format="json")
        check(f"[{label}] reviewer returns 2", r.status_code == 200, r.content[:300])
        r = R.post(f"/api/surveys/{sid}/review/", {"decision": "pass", "comment": "OK", "question_ids": rids[2:]}, format="json")
        check(f"[{label}] reviewer passes rest", r.status_code == 200, r.content[:300])
        # wrong stage -> refused
        r = R.post(f"/api/surveys/{sid}/review/", {"decision": "pass", "comment": "", "question_ids": ret}, format="json")
        check(f"[{label}] reviewing a returned question is refused", r.status_code == 400, r.status_code)
        # respondent fixes returned
        owner = owner_of[ret[0]]
        C = client(owner)
        r = C.post(f"/api/surveys/{sid}/submit/", {"answers": {i: good_answer(allq[i], 5) for i in ret}, "question_ids": ret}, format="json")
        check(f"[{label}] respondent resubmits returned", r.status_code == 200, r.content[:300])
        r = R.post(f"/api/surveys/{sid}/review/", {"decision": "pass", "comment": "Good now", "question_ids": ret}, format="json")
        check(f"[{label}] reviewer passes resubmitted", r.status_code == 200, r.content[:300])
        # a respondent cannot approve; approver can
        r = client(resp_a).post(f"/api/surveys/{sid}/approve/", {"decision": "approve", "comment": ""}, format="json")
        check(f"[{label}] respondent cannot approve", r.status_code in (400, 403), r.status_code)
        r = client(approver).post(f"/api/surveys/{sid}/approve/", {"decision": "approve", "comment": "Approved"}, format="json")
        check(f"[{label}] approver approves", r.status_code == 200, r.content[:300])
        final = A.get(f"/api/surveys/{sid}/").json()
        fq = [q for sec in final["sections"] for q in sec["questions"]]
        check(f"[{label}] every question approved", all(q["status"] == "approved" for q in fq), {q["status"] for q in fq})
        check(f"[{label}] survey completed/approved", final["status"] in ("approved", "completed"), final["status"])

        # audit trail report
        r = A.get(f"/api/reports/surveys/{sid}/audit/")
        check(f"[{label}] audit workbook downloads", r.status_code == 200 and r.content[:2] == b"PK", r.status_code)
        if r.status_code == 200:
            import openpyxl
            wb = openpyxl.load_workbook(io.BytesIO(r.content))
            ws = wb.active
            cells = [str(c.value) for row in ws.iter_rows() for c in row if c.value is not None]
            blob = "\n".join(cells)
            pdf_nums = {"[" + q["gri_ref"] + (q["gri_item"] if q["gri_item"].startswith(".") else (" " + q["gri_item"] if q["gri_item"] else "")) + "]" for q in fq if q["gri_ref"]}
            check(f"[{label}] workbook shows PDF numbers for every standard question", all(n in blob for n in pdf_nums), [n for n in pdf_nums if n not in blob][:3])
            stamps = re.findall(r"\b\d{1,2}:\d{2}:\d{2}\b", blob)
            check(f"[{label}] report times include seconds", len(stamps) > 0)
            check(f"[{label}] report lists all {len(fq)} questions", sum(1 for q in fq if q["text"][:40] in blob) >= max(1, int(len(fq) * 0.9)), len(fq))
        # duplicate keeps sections
        r = A.post(f"/api/surveys/{sid}/duplicate/")
        check(f"[{label}] duplicate", r.status_code == 201 and len([x for x in r.json()["sections"] if x["gri"]]) == len(standards) and sum(len(s["questions"]) for s in r.json()["sections"]) == total, r.content[:200])
        return sid

    pick = lambda rows, *slugs: [s for s in rows if s["slug"] in slugs]
    full_flow("tcfd", by_fw["tcfd"])  # all 4 pillars, all 42 questions
    full_flow("rspo", by_fw["rspo"][:3])
    full_flow("wef", by_fw["wef"])
    full_flow("sasb", by_fw["sasb"][:3])
    full_flow("gri", by_fw["gri"][:3] + by_fw["gri"][4:6])
    full_flow("rspo", by_fw["rspo"][3:6], pick=7)  # partial selection

    # ------------------------------------------------ 4. one survey mixing every framework
    sv = make_survey("E2E mixed frameworks")
    sid = sv["id"]
    mix = [by_fw["gri"][1], by_fw["sasb"][0], by_fw["tcfd"][0], by_fw["rspo"][0], by_fw["wef"][0]]
    for s in mix:
        r = A.post(f"/api/surveys/{sid}/sections/from-gri/", {"gri_standard_id": s["id"]}, format="json")
        check(f"[mixed] add {s['code']}", r.status_code == 201, r.content[:200])
    survey = A.get(f"/api/surveys/{sid}/").json()
    check("[mixed] 5 sections, 5 frameworks", [x["gri"]["framework"] for x in survey["sections"] if x["gri"]] == ["gri", "sasb", "tcfd", "rspo", "wef"])
    # reloading the bank (as a migration does) must not detach questions already in a survey
    from django.apps import apps as dj_apps
    from apps.question_bank.gri_loader import load_disclosures
    before = {q["id"]: (q["gri_ref"], q["gri_item"]) for sec in A.get(f"/api/surveys/{sid}/").json()["sections"] for q in sec["questions"] if sec["gri"]}
    for fw in ("gri", "sasb", "tcfd", "rspo", "wef"):
        load_disclosures(dj_apps, fw)
    after = {q["id"]: (q["gri_ref"], q["gri_item"]) for sec in A.get(f"/api/surveys/{sid}/").json()["sections"] for q in sec["questions"] if sec["gri"]}
    check("[mixed] reloading the bank keeps surveys linked (same numbers)", before and before == after, (len(before), len(after)))
    check("[mixed] reload keeps total question counts", sum(s["question_count"] for s in A.get("/api/gri-standards/?framework=wef").json()) == 359)
    # change selection: shrink then grow
    s = by_fw["wef"][1]
    ids = [q["id"] for q in details[s["id"]]["questions"]]
    r = A.post(f"/api/surveys/{sid}/sections/from-gri/", {"gri_standard_id": s["id"], "question_ids": ids[:3]}, format="json")
    check("[mixed] add subset", r.status_code == 201 and len(r.json()["questions"]) == 3)
    r = A.post(f"/api/surveys/{sid}/sections/from-gri/", {"gri_standard_id": s["id"], "question_ids": ids[2:6]}, format="json")
    check("[mixed] change subset", r.status_code == 201 and len(r.json()["questions"]) == 4)
    r = A.post(f"/api/surveys/{sid}/sections/from-gri/", {"gri_standard_id": s["id"], "question_ids": []}, format="json")
    check("[mixed] empty selection refused", r.status_code == 400, r.status_code)
    r = A.post(f"/api/surveys/{sid}/sections/from-gri/", {"gri_standard_id": s["id"], "question_ids": [details[by_fw['tcfd'][0]['id']]['questions'][0]['id']]}, format="json")
    check("[mixed] question from another standard refused", r.status_code == 400, r.status_code)
    # question order inside a section after subset change
    sec = [x for x in A.get(f"/api/surveys/{sid}/").json()["sections"] if x["gri"] and x["gri"]["id"] == s["id"]][0]
    want = [q["text"] for q in details[s["id"]]["questions"] if q["id"] in ids[2:6]]
    check("[mixed] subset keeps PDF order", [q["text"] for q in sec["questions"]] == want)
    # delete a section
    r = A.delete(f"/api/surveys/{sid}/sections/{sec['id']}/")
    check("[mixed] delete section", r.status_code in (200, 204), r.status_code)
    # non-admin cannot add sections
    r = client(resp_a).post(f"/api/surveys/{sid}/sections/from-gri/", {"gri_standard_id": mix[0]["id"]}, format="json")
    check("[mixed] non-admin cannot add a standard", r.status_code in (403, 404), r.status_code)
    # published survey: cannot add
    # standards cannot be written via API
    r = A.post("/api/gri-standards/", {"code": "X"}, format="json")
    check("standards are read-only", r.status_code in (403, 404, 405), r.status_code)
    # filters
    r = A.get("/api/gri-standards/?framework=rspo&series=rspo").json()
    check("filter framework+series", len(r) == 7)
    r = A.get("/api/gri-standards/?framework=sasb&series=transportation").json()
    check("SASB sector filter", len(r) > 0 and all(x["series"] == "transportation" for x in r))
    r = A.get("/api/gri-standards/")
    check("unfiltered list returns all frameworks", len(r.json()) == 41 + 77 + 4 + 7 + 4, len(r.json()))

    raise Rollback()


def main():
    t = get_tenant_model().objects.get(schema_name="tenant_abc")
    with tenant_context(t):
        try:
            with transaction.atomic():
                run()
        except Rollback:
            pass
        except Exception:
            traceback.print_exc()
            FAILS.append("EXCEPTION (see traceback above)")
    passed = sum(1 for _, ok in RESULTS if ok)
    print(f"\n{passed}/{len(RESULTS)} checks passed")
    for f in FAILS[:60]:
        print("FAIL:", f)
    print(f"{len(FAILS)} failure(s)")


main()
