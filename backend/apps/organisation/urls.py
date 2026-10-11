from rest_framework.routers import SimpleRouter

from apps.organisation.views import MemberViewSet, UnitViewSet

router = SimpleRouter()
router.register("units", UnitViewSet, basename="unit")
router.register("users", MemberViewSet, basename="user")

urlpatterns = router.urls
