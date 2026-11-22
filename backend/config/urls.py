from django.urls import include, path
from rest_framework.routers import DefaultRouter

from analysis.views import VideoViewSet

router = DefaultRouter()
router.register("videos", VideoViewSet)

urlpatterns = [path("api/", include(router.urls))]
