from rest_framework.routers import SimpleRouter

from apps.question_bank.views import BankCategoryViewSet, BankQuestionViewSet

router = SimpleRouter()
router.register("question-categories", BankCategoryViewSet, basename="question-category")
router.register("questions", BankQuestionViewSet, basename="question")

urlpatterns = router.urls
