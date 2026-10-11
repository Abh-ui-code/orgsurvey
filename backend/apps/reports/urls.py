from django.urls import path

from apps.reports import views

urlpatterns = [
    path("dashboard/", views.DashboardView.as_view(), name="reports-dashboard"),
    path("summary/", views.SummaryView.as_view(), name="reports-summary"),
]
