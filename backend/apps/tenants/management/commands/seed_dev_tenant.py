"""
Local development only. Provisions a workspace and fills it with a sample
organisation, people (one per workflow role), a question bank and surveys in
each stage. Refuses outright when DEBUG is false. Safe to re-run.
"""
import datetime

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django_tenants.utils import schema_context

DEV_PASSWORD = "devpassword"

# (key, full name, title, unit key, head of that unit?)
PEOPLE = [
    ("ceo", "Meera Kapoor", "Chief Executive", "org", True),
    ("ops", "Rohan Mehta", "VP Operations", "ops", True),
    ("anita", "Anita Desai", "Chief Technology Officer", "tech", True),
    ("sanjay", "Sanjay Rao", "Head of People", "hr", True),
    ("priya", "Priya Nair", "Logistics Manager", "log", True),
    ("vikram", "Vikram Singh", "Engineering Director", "eng", True),
    ("neha", "Neha Gupta", "Web Team Lead", "web", True),
    ("arjun", "Arjun Patel", "Frontend Engineer", "web", False),
    ("kavya", "Kavya Iyer", "Data Analyst", "data", False),
]
# (key, name, kind, parent key)
UNITS = [
    ("ops", "Operations", "division", "org"),
    ("tech", "Technology", "division", "org"),
    ("hr", "People & Culture", "division", "org"),
    ("log", "Logistics", "department", "ops"),
    ("fac", "Facilities", "department", "ops"),
    ("eng", "Engineering", "department", "tech"),
    ("web", "Web Team", "team", "eng"),
    ("data", "Data Team", "team", "eng"),
    ("rec", "Recruitment", "department", "hr"),
]
# (text, type, bank category, options)
QUESTIONS = [
    ("How satisfied are you with your team's communication?", "rating", "Engagement", []),
    ("I understand how my work contributes to the organisation's goals.", "yes_no", "Engagement", []),
    ("Which of these best describes your workload?", "single_choice", "Wellbeing",
     ["Too light", "About right", "Heavy", "Unsustainable"]),
    ("Which tools or resources would help your team most?", "multi_choice", "Resources",
     ["Training budget", "Better tooling", "More headcount", "Clearer priorities"]),
    ("What is the biggest obstacle your team currently faces?", "text", "Challenges", []),
    ("Does your team have documented processes for its critical work?", "yes_no", "Process", []),
    ("Rate the effectiveness of cross-department collaboration.", "rating", "Collaboration", []),
    ("Describe one change that would most improve how your department operates.", "text", "Improvement", []),
    ("On average, how many hours a week does your team spend in meetings?", "number", "Process", []),
]


class Command(BaseCommand):
    help = "Provision a development workspace with sample data. DEBUG-only."

    def add_arguments(self, parser):
        parser.add_argument("--subdomain", default="abc")
        parser.add_argument("--name", default="ABC Corporation")

    def handle(self, *args, **o):
        if not settings.DEBUG:
            raise CommandError("seed_dev_tenant refuses to run outside DEBUG.")
        from apps.tenants.models import Tenant
        from apps.tenants.services import provision_tenant

        sub = o["subdomain"]
        tenant = Tenant.objects.filter(subdomain=sub).first()
        if tenant is None:
            tenant = provision_tenant(
                name=o["name"], subdomain=sub, admin_email=self._email(sub, "admin"),
                admin_name="Admin User", admin_password=DEV_PASSWORD,
            )
            self.stdout.write(self.style.SUCCESS(f"Provisioned workspace '{sub}'."))
        else:
            self.stdout.write(f"Workspace '{sub}' already exists; reusing it.")

        self._seed(tenant)
        self.stdout.write(self.style.SUCCESS(
            f"\nSeeded http://{sub}.{settings.TENANT_BASE_DOMAIN}:3000 -- every password is '{DEV_PASSWORD}'."
            f"\n  admin@{sub}.{settings.TENANT_BASE_DOMAIN}   (administrator)"
            f"\n  neha@ (respondent)   vikram@ (reviewer)   anita@ (approver)   -- same domain\n"
        ))

    @staticmethod
    def _email(sub, local):
        return f"{local}@{sub}.{settings.TENANT_BASE_DOMAIN}"

    def _seed(self, tenant):
        from apps.organisation.models import Member, OrgUnit
        from apps.question_bank.models import Question
        from apps.surveys import services
        from apps.users.models import User, UserTenantMembership

        with schema_context(tenant.schema_name):
            if OrgUnit.objects.count() > 1:
                self.stdout.write("Sample data already present; skipping.")
                return

            root = OrgUnit.objects.get(parent__isnull=True)
            units = {"org": root}
            for key, name, kind, parent in UNITS:
                units[key] = OrgUnit.objects.create(name=name, kind=kind, parent=units[parent])

            people = {}
            admin = User.objects.get(email=self._email(tenant.subdomain, "admin"))
            people["admin"] = admin
            for key, name, title, unit_key, is_head in PEOPLE:
                user, _ = User.objects.get_or_create(
                    email=self._email(tenant.subdomain, key), defaults={"full_name": name}
                )
                user.set_password(DEV_PASSWORD)
                user.full_name = name
                user.save()
                UserTenantMembership.objects.get_or_create(user=user, tenant=tenant)
                Member.objects.create(user=user, role="member", unit=units[unit_key], title=title)
                if is_head:
                    OrgUnit.objects.filter(pk=units[unit_key].pk).update(head=user)
                people[key] = user
            root.head = people["ceo"]
            root.save(update_fields=["head"])

            from apps.question_bank.models import BankCategory
            from apps.surveys.models import SurveyCategory

            cats = {c.label: c for c in BankCategory.objects.all()}
            qs = [
                Question.objects.create(text=t, type=ty, category=cats[c], options=op)
                for t, ty, c, op in QUESTIONS
            ]
            survey_cat = {c.code: c for c in SurveyCategory.objects.all()}
            today = datetime.date.today()

            def build(title, desc, category, unit, sections, people_keys=None, days=None, instructions=""):
                """Create a draft, fill its sections from the bank, optionally assign the three people."""
                survey = services.create_draft(
                    title=title, description=desc, category=survey_cat[category],
                    target_unit=units[unit], creator=admin,
                )
                fields = {"instructions": instructions}
                if people_keys:
                    fields.update(zip(("responder", "reviewer", "approver"), (people[k] for k in people_keys)))
                if days is not None:
                    fields["due_date"] = today + datetime.timedelta(days=days)
                services.update_survey(survey, **fields)
                first_section = survey.sections.first()
                for i, (section_title, idx) in enumerate(sections):
                    if i == 0:
                        section = services.update_section(first_section, title=section_title)
                    else:
                        section = services.add_section(survey, title=section_title)
                    for q in idx:
                        services.add_question_from_bank(section, qs[q])
                return survey

            def sample_answers(survey):
                out = {}
                for q in services.all_questions(survey):
                    out[str(q.id)] = {"rating": 4, "yes_no": "Yes", "number": 6,
                                      "single_choice": q.options[1] if q.options else "",
                                      "multi_choice": q.options[:2]}.get(q.type, "Sample answer provided during setup.")
                return out

            def run(survey, resp, rev=None, appr=None):
                services.publish(survey, admin)
                services.submit_response(survey, people[resp], sample_answers(survey))
                if rev:
                    services.review(survey, people[rev], "pass", "Looks complete.")
                if appr:
                    services.approve(survey, people[appr], "approve", "")

            pulse = build("Engineering Team Pulse - Q4",
                          "Quarterly pulse on communication, workload and tooling in Engineering.",
                          "engagement", "eng", [("Team & communication", [0, 2]), ("Tools & obstacles", [3, 4])],
                          ("neha", "vikram", "anita"), 7, "Answer for the whole Web Team, not just yourself.")
            services.publish(pulse, admin)

            ops_s = build("Operations Process Review",
                          "Review of documented processes and collaboration across Operations.",
                          "operations", "ops", [("Processes", [5, 6]), ("Improvement", [7])],
                          ("priya", "ops", "ceo"), 3)
            run(ops_s, "priya")

            org_s = build("Organisation-wide Engagement 2026", "Annual engagement survey for the whole organisation.",
                          "engagement", "org", [("Engagement", [0, 1, 6])], ("sanjay", "ops", "ceo"), 21)
            run(org_s, "sanjay", "ops")

            done = build("Meeting Load Check", "How much time teams spend in meetings.",
                         "operations", "data", [("Meetings", [8, 4])], ("kavya", "vikram", "anita"), -2)
            run(done, "kavya", "vikram", "anita")

            build("Remote Work Policy Feedback", "Draft: gathering views on the proposed remote-work policy.",
                  "hr-people", "hr", [("Policy", [1, 7])])
