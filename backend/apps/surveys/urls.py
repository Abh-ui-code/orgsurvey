from rest_framework.routers import SimpleRouter
from rest_framework_nested.routers import NestedSimpleRouter

from apps.surveys.views import SurveyCategoryViewSet, SurveyQuestionViewSet, SurveySectionViewSet, SurveyViewSet

router = SimpleRouter()
router.register("survey-categories", SurveyCategoryViewSet, basename="survey-category")
router.register("surveys", SurveyViewSet, basename="survey")

# /surveys/{survey_pk}/sections/ and /surveys/{survey_pk}/sections/{section_pk}/questions/
sections = NestedSimpleRouter(router, "surveys", lookup="survey")
sections.register("sections", SurveySectionViewSet, basename="survey-section")
questions = NestedSimpleRouter(sections, "sections", lookup="section")
questions.register("questions", SurveyQuestionViewSet, basename="survey-section-question")

urlpatterns = [*router.urls, *sections.urls, *questions.urls]
