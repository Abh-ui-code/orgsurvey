from rest_framework import serializers

from apps.core.serializers import IdField, QuestionFieldsSerializer
from apps.question_bank.models import BankCategory, Question


class BankCategorySerializer(serializers.ModelSerializer):
    question_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = BankCategory
        fields = ["id", "label", "description", "display_order", "question_count"]
        read_only_fields = ["display_order"]

    def validate_label(self, value):
        value = value.strip()
        clash = BankCategory.objects.filter(label__iexact=value)
        if self.instance is not None:
            clash = clash.exclude(pk=self.instance.pk)
        if not value:
            raise serializers.ValidationError("Category name is required.")
        if clash.exists():
            raise serializers.ValidationError("A category with that name already exists.")
        return value

    def create(self, validated):
        validated["display_order"] = BankCategory.objects.count() + 1
        return super().create(validated)


class CategoryRefSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    label = serializers.CharField(read_only=True)


class BankQuestionSerializer(QuestionFieldsSerializer):
    category = CategoryRefSerializer(read_only=True)
    category_id = IdField(source="category", queryset=BankCategory.objects.all(), write_only=True)

    class Meta:
        model = Question
        fields = ["id", "text", "type", "options", "hint", "required", "category", "category_id"]
