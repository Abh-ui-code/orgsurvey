from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.views import exception_handler as drf_exception_handler


class ApiError(APIException):
    """A business-rule failure with a message the UI shows as-is."""

    status_code = status.HTTP_400_BAD_REQUEST
    default_code = "invalid"


def exception_handler(exc, context):
    """Every error leaves as {"detail": "<one readable message>"} so the web
    client has a single shape to read."""
    response = drf_exception_handler(exc, context)
    if response is None:
        return None
    data = response.data
    if isinstance(data, dict) and "detail" not in data:
        first_field, errors = next(iter(data.items()), ("", ""))
        message = errors[0] if isinstance(errors, list) and errors else errors
        label = "" if first_field in ("", "non_field_errors") else f"{first_field}: "
        response.data = {"detail": f"{label}{message}"}
    elif isinstance(data, list):
        response.data = {"detail": str(data[0]) if data else "Invalid request."}
    return response
