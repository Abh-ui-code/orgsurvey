from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers

from apps.core.serializers import IdField, PersonSerializer, UnitRefSerializer
from apps.core.tenant_context import current_tenant
from apps.organisation.models import Member, OrgUnit
from apps.users.models import UserTenantMembership

User = get_user_model()
MIN_PASSWORD = 8


class UnitSerializer(serializers.ModelSerializer):
    """An org block. Reads give the head as a person and a live member count;
    writes take `parent_id` and `head_id`."""

    parent_id = IdField(
        source="parent", queryset=OrgUnit.objects.all(), allow_null=True, required=False
    )
    head = PersonSerializer(read_only=True)
    head_id = IdField(
        source="head", queryset=User.objects.all(), allow_null=True, required=False, write_only=True
    )
    member_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = OrgUnit
        fields = ["id", "parent_id", "name", "kind", "head", "head_id", "member_count"]

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Name is required.")
        return value

    def validate(self, attrs):
        unit = self.instance
        if "parent" in attrs or unit is None:
            parent = attrs.get("parent")
            others = OrgUnit.objects.filter(parent__isnull=True)
            if unit is not None:
                others = others.exclude(pk=unit.pk)
            if parent is None and others.exists():
                raise serializers.ValidationError("The organisation already has a root block.")
            if unit is not None and parent is not None and (parent.pk == unit.pk or parent.pk in unit.descendant_ids()):
                raise serializers.ValidationError("A block cannot be moved under itself or one of its own children.")
        head = attrs.get("head")
        if head is not None and not Member.objects.filter(user=head, is_active=True).exists():
            raise serializers.ValidationError("The head must be someone in this workspace.")
        return attrs


class MemberSerializer(serializers.ModelSerializer):
    """A person as seen inside one workspace: identity from the public User,
    access level, block and title from this workspace's Member row. The id is
    the *user's* id, which is what surveys and blocks refer to."""

    id = serializers.UUIDField(source="user_id", read_only=True)
    full_name = serializers.CharField(source="user.full_name", max_length=255)
    email = serializers.EmailField(source="user.email")
    unit = UnitRefSerializer(read_only=True)
    unit_id = IdField(
        source="unit", queryset=OrgUnit.objects.all(), allow_null=True, required=False, write_only=True
    )
    password = serializers.CharField(write_only=True, required=False, allow_blank=True, trim_whitespace=False)

    class Meta:
        model = Member
        fields = ["id", "full_name", "email", "role", "title", "unit", "unit_id", "is_active", "password"]

    def validate_email(self, value):
        return value.strip().lower()

    def validate_full_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Name is required.")
        return value

    def _check_password(self, password):
        if len(password) < MIN_PASSWORD:
            raise serializers.ValidationError({"password": f"Use at least {MIN_PASSWORD} characters."})

    @transaction.atomic
    def create(self, validated):
        user_data = validated.pop("user")
        password = validated.pop("password", "")
        email = user_data["email"]
        user = User.objects.filter(email=email).first()
        if user is not None and Member.objects.filter(user=user).exists():
            raise serializers.ValidationError({"email": "A user with this email already exists."})
        if user is None:
            self._check_password(password)  # a person who already has a login elsewhere keeps their own password
            user = User.objects.create_user(email=email, password=password, full_name=user_data["full_name"])
        UserTenantMembership.objects.update_or_create(
            user=user, tenant=current_tenant(self.context["request"]), defaults={"is_active": True}
        )
        return Member.objects.create(user=user, **validated)

    @transaction.atomic
    def update(self, member, validated):
        user_data = validated.pop("user", {})
        password = validated.pop("password", "")
        user = member.user

        email = user_data.get("email", user.email)
        if User.objects.filter(email=email).exclude(pk=user.pk).exists():
            raise serializers.ValidationError({"email": "A user with this email already exists."})

        role = validated.get("role", member.role)
        active = validated.get("is_active", member.is_active)
        if member.role == "admin" and (role != "admin" or not active):
            if not Member.objects.filter(role="admin", is_active=True).exclude(pk=member.pk).exists():
                raise serializers.ValidationError("There must be at least one active administrator.")

        user.email = email
        user.full_name = user_data.get("full_name", user.full_name)
        if password:
            self._check_password(password)
            user.set_password(password)
        user.save()

        for attr, value in validated.items():
            setattr(member, attr, value)
        member.save()
        UserTenantMembership.objects.filter(user=user, tenant=current_tenant(self.context["request"])).update(
            is_active=member.is_active
        )
        return member
