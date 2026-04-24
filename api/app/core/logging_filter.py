"""Redacta secrets (X-API-Key, tokens artf_*) de los logs."""
import logging
import re

_TOKEN_PATTERN = re.compile(r"artf_(?:live|test)_[A-Za-z0-9_-]+")
_HEADER_PATTERN = re.compile(r"(x-api-key\s*[:=]\s*)\S+", re.IGNORECASE)


class RedactSecretsFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        try:
            msg = record.getMessage()
        except Exception:
            return True
        redacted = _TOKEN_PATTERN.sub("artf_***REDACTED***", msg)
        redacted = _HEADER_PATTERN.sub(r"\1***REDACTED***", redacted)
        if redacted != msg:
            record.msg = redacted
            record.args = ()
        return True


def install_redaction() -> None:
    root = logging.getLogger()
    flt = RedactSecretsFilter()
    for handler in root.handlers:
        handler.addFilter(flt)
    logging.getLogger("uvicorn.access").addFilter(flt)
    logging.getLogger("uvicorn.error").addFilter(flt)
