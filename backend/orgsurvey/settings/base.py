"""
Base settings for OrgSurvey. Every environment variable is declared once,
here, with its default.
"""
import re
from datetime import timedelta
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env(
    DJANGO_DEBUG=(bool, False),
    DJANGO_ALLOWED_HOSTS=(list, ["localhost", "127.0.0.1"]),
    TENANT_BASE_DOMAIN=(str, "localhost"),
    TENANT_PLATFORM_SUBDOMAINS=(list, ["admin", "api", "www", "app"]),
    TIME_ZONE=(str, "UTC"),
    JWT_ACCESS_TOKEN_LIFETIME_MIN=(int, 30),
    JWT_REFRESH_TOKEN_LIFETIME_DAYS=(int, 7),
)
environ.Env.read_env(str(BASE_DIR / ".env"))

SECRET_KEY = env("DJANGO_SECRET_KEY", default="dev-insecure-secret-key-change-me")
DEBUG = env("DJANGO_DEBUG")
ALLOWED_HOSTS = env("DJANGO_ALLOWED_HOSTS")

# A tenant lives at <subdomain>.<TENANT_BASE_DOMAIN>, e.g. abc.localhost.
TENANT_BASE_DOMAIN = env("TENANT_BASE_DOMAIN")
TENANT_PLATFORM_SUBDOMAINS = env("TENANT_PLATFORM_SUBDOMAINS")

# ---------------------------------------------------------------------------
# Apps. SHARED apps live in the public schema (tenants, users, login);
# TENANT apps are migrated into every tenant's own schema.
# ---------------------------------------------------------------------------
SHARED_APPS = [
    "django_tenants",
    "apps.tenants",
    "apps.core",
    "apps.users",
    "apps.authentication",
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "django.contrib.sessions",
    "django.contrib.messages",
    "rest_framework",
    "django_filters",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
]

TENANT_APPS = [
    "django.contrib.contenttypes",
    "apps.organisation",
    "apps.question_bank",
    "apps.surveys",
    "apps.reports",
]

INSTALLED_APPS = list(SHARED_APPS) + [a for a in TENANT_APPS if a not in SHARED_APPS]

TENANT_MODEL = "tenants.Tenant"
TENANT_DOMAIN_MODEL = "tenants.Domain"
PUBLIC_SCHEMA_NAME = "public"

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "apps.core.tenant_middleware.PublicFallbackTenantMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
]

ROOT_URLCONF = "orgsurvey.urls_tenant"
PUBLIC_SCHEMA_URLCONF = "orgsurvey.urls_public"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "orgsurvey.wsgi.application"

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
DATABASES = {
    "default": {
        **env.db_url(
            "DATABASE_URL",
            default="postgres://orgsurvey:orgsurvey@localhost:5432/orgsurvey_dev",
        ),
        "ENGINE": "django_tenants.postgresql_backend",
        "CONN_MAX_AGE": 60,
    }
}
DATABASE_ROUTERS = ("django_tenants.routers.TenantSyncRouter",)

CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}

# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
AUTH_USER_MODEL = "users.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
]
PASSWORD_HASHERS = ["django.contrib.auth.hashers.Argon2PasswordHasher"]

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ("rest_framework_simplejwt.authentication.JWTAuthentication",),
    "DEFAULT_PERMISSION_CLASSES": ("apps.core.permissions.IsTenantMember",),
    "DEFAULT_PAGINATION_CLASS": "apps.core.pagination.PageSizePagination",
    "PAGE_SIZE": 25,
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),
    "EXCEPTION_HANDLER": "apps.core.exceptions.exception_handler",
    "TEST_REQUEST_DEFAULT_FORMAT": "json",
    "DEFAULT_THROTTLE_RATES": {"login": "30/min"},
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=env("JWT_ACCESS_TOKEN_LIFETIME_MIN")),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=env("JWT_REFRESH_TOKEN_LIFETIME_DAYS")),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
    "TOKEN_OBTAIN_SERIALIZER": "apps.authentication.serializers.TenantTokenObtainPairSerializer",
}

# ---------------------------------------------------------------------------
# CORS -- parametric on the tenant base domain, never a static list of tenants
# ---------------------------------------------------------------------------
_domain_re = re.escape(TENANT_BASE_DOMAIN)
CORS_ALLOWED_ORIGIN_REGEXES = [rf"^https://([\w-]+\.)?{_domain_re}$"]
if DEBUG:
    CORS_ALLOWED_ORIGIN_REGEXES.append(rf"^http://([\w-]+\.)?{_domain_re}:(3000|3001|3100)$")
CORS_ALLOW_CREDENTIALS = True

LANGUAGE_CODE = "en-us"
# Decides what "today" means for due dates and overdue counts. Set it to the
# organisation's own zone (e.g. Asia/Kolkata) so a survey due on the 12th is
# overdue from midnight on the 13th *there*, not at 5:30 am.
TIME_ZONE = env("TIME_ZONE")
USE_I18N = False
USE_TZ = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
