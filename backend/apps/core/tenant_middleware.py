"""
Tenant resolution: host -> Domain row -> tenant schema.

1. Host matches a `Domain` row (abc.localhost)  -> that tenant's schema.
2. Host is a platform host (localhost, www.localhost, an IP) -> public schema.
3. Anything else -> 404 (a genuine typo, never a silent fallback).

A tenant an operator has deactivated answers 403 rather than 404 so the
web app can say "this workspace is suspended".
"""
from django.conf import settings
from django.db import connection
from django.http import JsonResponse
from django.urls import set_urlconf
from django_tenants.middleware.main import TenantMainMiddleware
from django_tenants.utils import get_tenant_domain_model


def _is_platform_host(hostname: str) -> bool:
    base = settings.TENANT_BASE_DOMAIN
    if hostname in {base, "localhost", "127.0.0.1", "testserver"}:
        return True
    if any(hostname == f"{sub}.{base}" for sub in settings.TENANT_PLATFORM_SUBDOMAINS):
        return True
    parts = hostname.split(".")
    return len(parts) == 4 and all(p.isdigit() for p in parts)


class PublicFallbackTenantMiddleware(TenantMainMiddleware):
    def process_request(self, request):
        hostname = request.get_host().split(":")[0]
        Domain = get_tenant_domain_model()

        domain = Domain.objects.filter(domain=hostname).select_related("tenant").first()
        if domain is not None:
            tenant = domain.tenant
            if not tenant.is_active or not tenant.is_ready:
                return JsonResponse({"detail": "This workspace is not available."}, status=403)
            request.tenant = tenant
            connection.set_tenant(tenant)
            self.setup_url_routing(request)
            return None

        if _is_platform_host(hostname):
            request.tenant = None
            connection.set_schema_to_public()
            request.urlconf = settings.PUBLIC_SCHEMA_URLCONF
            set_urlconf(settings.PUBLIC_SCHEMA_URLCONF)
            return None

        return JsonResponse({"detail": f"No workspace found for {hostname}."}, status=404)
