from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.authentication.serializers import TenantTokenObtainPairSerializer
from apps.core.exceptions import ApiError
from apps.core.permissions import IsTenantMember, member_for
from apps.core.tenant_context import current_tenant
from apps.organisation.serializers import MemberSerializer


class LoginView(TokenObtainPairView):
    serializer_class = TenantTokenObtainPairSerializer
    permission_classes = [AllowAny]
    authentication_classes: list = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"


class RefreshView(TokenRefreshView):
    permission_classes = [AllowAny]
    authentication_classes: list = []


class LogoutView(APIView):
    permission_classes = [AllowAny]
    authentication_classes: list = []

    def post(self, request):
        try:
            RefreshToken(request.data.get("refresh", "")).blacklist()
        except TokenError:
            pass  # already expired or blacklisted: signed out either way
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProfileSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=255)
    title = serializers.CharField(max_length=255, required=False, allow_blank=True)


class PasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField()
    new_password = serializers.CharField(min_length=8, error_messages={"min_length": "Use at least 8 characters."})


def _me(request) -> dict:
    """The signed-in person as a workspace member, plus the workspace itself."""
    tenant = current_tenant(request)
    data = MemberSerializer(member_for(request), context={"request": request}).data
    return {**data, "tenant": {"name": tenant.name, "subdomain": tenant.subdomain}}


class MeView(APIView):
    permission_classes = [IsTenantMember]

    def get(self, request):
        return Response(_me(request))

    def patch(self, request):
        serializer = ProfileSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        member = member_for(request)
        request.user.full_name = serializer.validated_data["full_name"].strip()
        request.user.save(update_fields=["full_name"])
        if "title" in serializer.validated_data:
            member.title = serializer.validated_data["title"].strip()
            member.save(update_fields=["title"])
        return Response(_me(request))


class ChangePasswordView(APIView):
    permission_classes = [IsTenantMember]

    def post(self, request):
        serializer = PasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if not request.user.check_password(serializer.validated_data["current_password"]):
            raise ApiError("Current password is incorrect.")
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save(update_fields=["password"])
        return Response({"detail": "Password changed."})
