from django.contrib.auth import authenticate
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from apps.core.tenant_context import current_tenant
from apps.users.models import UserTenantMembership


class TenantTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Logs a person in to the workspace on the request's subdomain and stamps
    `tenant_schema` into the token, so the token is only ever valid there.

    Right password but no membership for *this* workspace is reported as
    exactly that, not as a generic credentials error -- the password was
    fine, the address was wrong.
    """

    INVALID = "Invalid email or password."
    NO_ACCESS = "You don't have access to this workspace."
    NO_TENANT = "Sign in from your workspace address, for example abc.localhost."

    @classmethod
    def get_token(cls, user, tenant=None):
        token = super().get_token(user)
        if tenant is not None:
            token["tenant_schema"] = tenant.schema_name
        return token

    def validate(self, attrs):
        request = self.context["request"]
        user = authenticate(request=request, username=attrs["email"].lower(), password=attrs["password"])
        if user is None or not user.is_active:
            raise AuthenticationFailed(self.INVALID)

        tenant = current_tenant(request)
        if tenant is None:
            raise PermissionDenied(self.NO_TENANT)
        if not UserTenantMembership.objects.filter(user=user, tenant=tenant, is_active=True).exists():
            raise PermissionDenied(self.NO_ACCESS)

        from apps.organisation.models import Member

        if not Member.objects.filter(user_id=user.id, is_active=True).exists():
            raise PermissionDenied(self.NO_ACCESS)

        refresh = self.get_token(user, tenant=tenant)
        return {"refresh": str(refresh), "access": str(refresh.access_token)}
