import html
import re
import time
import unicodedata
from collections import defaultdict

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

MAX_QUERY_LENGTH = 100
GREEK_RE = re.compile(r"^[Ͱ-Ͽἀ-῿\s]+$")


def validate_query(q: str) -> str | None:
    q = unicodedata.normalize("NFC", q.strip())
    if not q or len(q) > MAX_QUERY_LENGTH:
        return None
    if not GREEK_RE.match(q):
        return None
    q = re.sub(r"\s+", " ", q)
    return q


def sanitize_highlight(text: str) -> str:
    text = text.replace("<mark>", "\x00M\x00").replace("</mark>", "\x00/M\x00")
    text = html.escape(text)
    text = text.replace("\x00M\x00", "<mark>").replace("\x00/M\x00", "</mark>")
    return text


class RateLimiter:
    def __init__(self, max_requests: int = 30, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window = window_seconds
        self.requests: dict[str, list[float]] = defaultdict(list)
        self._last_cleanup = time.time()

    def is_allowed(self, key: str) -> bool:
        now = time.time()
        if now - self._last_cleanup > self.window * 2:
            self._cleanup(now)
        cutoff = now - self.window
        self.requests[key] = [t for t in self.requests[key] if t > cutoff]
        if len(self.requests[key]) >= self.max_requests:
            return False
        self.requests[key].append(now)
        return True

    def _cleanup(self, now: float):
        cutoff = now - self.window
        stale = [k for k, v in self.requests.items() if not v or v[-1] < cutoff]
        for k in stale:
            del self.requests[k]
        self._last_cleanup = now


_limiter = RateLimiter(max_requests=30, window_seconds=60)


class SecurityMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.url.path.startswith("/api/"):
            client_ip = request.client.host if request.client else "unknown"
            if not _limiter.is_allowed(client_ip):
                return Response(
                    content='{"detail":"Υπερβολικά πολλά αιτήματα. Δοκιμάστε ξανά σε λίγο."}',
                    status_code=429,
                    media_type="application/json",
                )

        response = await call_next(request)

        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src https://fonts.gstatic.com; "
            "img-src 'self' data:; "
            "script-src 'self'"
        )

        return response
