import re

from .base import *  # noqa: F401,F403
from .base import CORS_ALLOWED_ORIGIN_REGEXES, REST_FRAMEWORK, TENANT_BASE_DOMAIN

DEBUG = True
ALLOWED_HOSTS = ["*"]

# Any <workspace>.localhost origin on the dev web ports may call the API.
CORS_ALLOWED_ORIGIN_REGEXES = [
    *CORS_ALLOWED_ORIGIN_REGEXES,
    rf"^http://([\w-]+\.)?{re.escape(TENANT_BASE_DOMAIN)}:(3000|3001|3100)$",
]

# Production keeps the strict login limit from base.py; development relaxes
# it so the smoke test and repeated manual sign-ins don't hit HTTP 429.
REST_FRAMEWORK = {**REST_FRAMEWORK, "DEFAULT_THROTTLE_RATES": {"login": "600/min"}}
