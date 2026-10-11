class TenantScopedMixin:
    """
    Mixin for every tenant viewset: stamps `created_by` / `updated_by` from
    the authenticated user when the model has those fields, so views never
    do it by hand.
    """

    def perform_create(self, serializer):
        extra = {}
        if hasattr(serializer.Meta.model, "created_by_id"):
            extra["created_by"] = self.request.user
        serializer.save(**extra)

    def perform_update(self, serializer):
        extra = {}
        if hasattr(serializer.Meta.model, "updated_by_id"):
            extra["updated_by"] = self.request.user
        serializer.save(**extra)
