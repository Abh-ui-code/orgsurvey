"""
Tenant provisioning. Deliberately NOT one atomic transaction: creating a
schema and running its migrations commit as they go. Each failure is
recorded on the tenant row instead of leaving a half-built workspace with no
trail -- and the partial schema is kept, as the only evidence of what failed.
"""
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.db import transaction
from django_tenants.utils import schema_context

from apps.tenants.models import Domain, Tenant


class ProvisioningError(Exception):
    pass


def provision_tenant(*, name: str, subdomain: str, admin_email: str, admin_name: str, admin_password: str) -> Tenant:
    """
    1. Create the Tenant and its Domain (<subdomain>.<base domain>) in the public schema.
    2. Create the tenant's schema and migrate it.
    3. Create the root org block and the first administrator.
    """
    if len(admin_password) < 8:
        raise ValidationError("The admin password must be at least 8 characters.")
    tenant = _create_tenant_and_domain(name, subdomain)
    try:
        tenant.create_schema(check_if_exists=True)
        call_command("migrate_schemas", tenant=True, schema_name=tenant.schema_name, interactive=False, verbosity=0)
        _create_admin(tenant, admin_email, admin_name, admin_password)
        tenant.is_ready = True
        tenant.provisioning_error = ""
        tenant.save(update_fields=["is_ready", "provisioning_error"])
        return tenant
    except Exception as exc:  # noqa: BLE001 -- record, then re-raise
        tenant.provisioning_error = str(exc)
        tenant.save(update_fields=["provisioning_error"])
        raise ProvisioningError(str(exc)) from exc


@transaction.atomic
def _create_tenant_and_domain(name: str, subdomain: str) -> Tenant:
    if Tenant.objects.filter(subdomain=subdomain).exists():
        raise ValidationError(f"Subdomain '{subdomain}' is already taken.")
    tenant = Tenant(name=name, subdomain=subdomain)
    tenant.full_clean(exclude=["schema_name"])
    tenant.save()
    Domain.objects.create(tenant=tenant, domain=f"{subdomain}.{settings.TENANT_BASE_DOMAIN}", is_primary=True)
    return tenant


@transaction.atomic
def _create_admin(tenant: Tenant, email: str, full_name: str, password: str):
    from apps.organisation.models import Member, OrgUnit
    from apps.users.models import User, UserTenantMembership

    user, created = User.objects.get_or_create(email=email.lower(), defaults={"full_name": full_name})
    if created:
        user.set_password(password)
        user.save(update_fields=["password"])
    UserTenantMembership.objects.get_or_create(user=user, tenant=tenant)

    with schema_context(tenant.schema_name):
        root = OrgUnit.objects.create(name=tenant.name, kind="organisation", head=user)
        Member.objects.create(user=user, role="admin", unit=root, title="Administrator")
