from django.core.management.base import BaseCommand, CommandError

from apps.tenants.services import provision_tenant


class Command(BaseCommand):
    help = "Create a new workspace: schema, domain (<subdomain>.<base domain>), root org block and first admin."

    def add_arguments(self, parser):
        parser.add_argument("--subdomain", required=True)
        parser.add_argument("--name", required=True)
        parser.add_argument("--admin-email", required=True)
        parser.add_argument("--admin-name", default="Administrator")
        parser.add_argument("--admin-password", required=True)

    def handle(self, *args, **o):
        try:
            tenant = provision_tenant(
                name=o["name"], subdomain=o["subdomain"], admin_email=o["admin_email"],
                admin_name=o["admin_name"], admin_password=o["admin_password"],
            )
        except Exception as exc:  # noqa: BLE001
            raise CommandError(str(exc)) from exc
        self.stdout.write(self.style.SUCCESS(f"Created workspace '{tenant.name}' at {tenant.subdomain}."))
