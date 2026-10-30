from rest_framework.routers import SimpleRouter

from apps.question_bank.views import BankCategoryViewSet, BankQuestionViewSet, GriStandardViewSet

router = SimpleRouter()
router.register("question-categories", BankCategoryViewSet, basename="question-category")
router.register("gri-standards", GriStandardViewSet, basename="gri-standard")
router.register("questions", BankQuestionViewSet, basename="question")

urlpatterns = router.urls
