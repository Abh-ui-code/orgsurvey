import uuid

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models

from apps.users.managers import UserManager


class User(AbstractBaseUser, PermissionsMixin):
    """
    Public schema: one login identity, email as the username. A person can
    belong to several tenants -- see UserTenantMembership. What they may do
    *inside* a tenant (admin or member, their org block, their title) lives
    in that tenant's own schema, on organisation.Member.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=255, blank=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []

    class Meta:
        app_label = "users"

    def __str__(self):
        return self.email


class UserTenantMembership(models.Model):
    """Answers "may this person sign in to this workspace?" Permissions
    inside it always come from the tenant-schema Member row."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="memberships")
    tenant = models.ForeignKey("tenants.Tenant", on_delete=models.CASCADE, related_name="memberships")
    is_active = models.BooleanField(default=True)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = "users"
        db_table = "user_tenant_memberships"
        constraints = [models.UniqueConstraint(fields=["user", "tenant"], name="uniq_user_tenant_membership")]
