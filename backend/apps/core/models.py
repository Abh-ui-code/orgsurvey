"""
Abstract base models shared by every tenant-schema app. Nothing here is a
concrete table -- `core` owns no migrations of its own.

People are referenced with a foreign key to the public-schema User and
`db_constraint=False`: the relation works in the ORM (joins, select_related)
but PostgreSQL does not enforce it, because the two tables live in different
schemas. See docs/architecture/MULTI_TENANCY.md.
"""
import uuid

from django.conf import settings
from django.db import models


class BaseModel(models.Model):
    """UUID primary key and timestamps -- the baseline for every domain model."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


def user_fk(**kwargs) -> models.ForeignKey:
    """A reference to a person (public-schema User) from a tenant table."""
    kwargs.setdefault("null", True)
    kwargs.setdefault("blank", True)
    kwargs.setdefault("on_delete", models.SET_NULL)
    kwargs.setdefault("related_name", "+")
    return models.ForeignKey(settings.AUTH_USER_MODEL, db_constraint=False, **kwargs)


class AuthoredModel(models.Model):
    """`created_by` / `updated_by` for records people write."""

    created_by = user_fk()
    updated_by = user_fk()

    class Meta:
        abstract = True
