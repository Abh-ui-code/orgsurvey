"""The single seam for "which tenant is this request for"."""
from django_tenants.utils import get_public_schema_name


def current_tenant(request):
    """django-tenants leaves a truthy stub on the public schema; normalise it to None."""
    tenant = getattr(request, "tenant", None)
    if tenant is None or getattr(tenant, "schema_name", None) == get_public_schema_name():
        return None
    return tenant
