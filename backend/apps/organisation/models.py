from django.conf import settings
from django.db import models

from apps.core.models import BaseModel, user_fk


class OrgUnit(BaseModel):
    """One block in the org hierarchy. `parent is None` marks the single root."""

    KINDS = [("organisation", "Organisation"), ("division", "Division"), ("department", "Department"), ("team", "Team")]

    parent = models.ForeignKey("self", null=True, blank=True, on_delete=models.PROTECT, related_name="children")
    name = models.CharField(max_length=255)
    kind = models.CharField(max_length=20, choices=KINDS, default="team")
    head = user_fk()

    class Meta:
        app_label = "organisation"
        ordering = ["name"]

    def __str__(self):
        return self.name

    def descendant_ids(self) -> list:
        """Every block beneath this one, at any depth."""
        out, frontier = [], [self.id]
        while frontier:
            kids = list(OrgUnit.objects.filter(parent_id__in=frontier).values_list("id", flat=True))
            out.extend(kids)
            frontier = kids
        return out


class Member(BaseModel):
    """A person's standing inside this workspace: their access level, where
    they sit in the hierarchy and their title. Lives in the tenant schema and
    points at the public-schema User, who may belong to other workspaces too."""

    ROLES = [("admin", "Administrator"), ("member", "Member")]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, db_constraint=False, related_name="+"
    )
    role = models.CharField(max_length=10, choices=ROLES, default="member")
    unit = models.ForeignKey(OrgUnit, null=True, blank=True, on_delete=models.SET_NULL, related_name="members")
    title = models.CharField(max_length=255, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        app_label = "organisation"
        ordering = ["user__full_name"]

    def __str__(self):
        return f"{self.user.full_name} ({self.role})"
