from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

User = get_user_model()


class IdField(serializers.PrimaryKeyRelatedField):
    """A reference by primary key. A malformed id is reported as a normal
    validation error instead of surfacing as a server error."""

    def to_internal_value(self, data):
        try:
            return super().to_internal_value(data)
        except DjangoValidationError:
            self.fail("incorrect_type", data_type=type(data).__name__)


class PersonSerializer(serializers.ModelSerializer):
    """A person as a compact reference, for embedding in other payloads."""

    class Meta:
        model = User
        fields = ["id", "full_name", "email"]
        read_only_fields = fields


class UnitRefSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    name = serializers.CharField(read_only=True)


class QuestionFieldsSerializer(serializers.ModelSerializer):
    """Shared validation for anything shaped like a question (a bank question
    or a survey question), so both obey the same rules: text required, a known
    type, and at least two distinct options for the choice types."""

    def validate(self, attrs):
        from apps.core.exceptions import ApiError
        from apps.core.question_types import clean_question_fields

        current = {}
        if self.instance is not None:
            current = {f: getattr(self.instance, f) for f in ("text", "type", "options", "hint", "required")}
        try:
            cleaned = clean_question_fields({**current, **attrs})
        except ApiError as exc:
            raise serializers.ValidationError(str(exc.detail)) from exc
        attrs.update(cleaned)
        return attrs
