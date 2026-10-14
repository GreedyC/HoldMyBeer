"""Opt-in, read-only Hermes status scaffold for HoldMyBeer."""

import json
import os
from urllib.error import URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, build_opener


DEFAULT_URL = "http://127.0.0.1:18940"
LOOPBACK_HOSTS = {"localhost", "127.0.0.1", "::1"}


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def _status_url():
    raw = os.environ.get("HMB_URL", DEFAULT_URL)
    parsed = urlsplit(raw)
    if (
        parsed.scheme != "http"
        or parsed.hostname not in LOOPBACK_HOSTS
        or parsed.username is not None
        or parsed.password is not None
        or parsed.query
        or parsed.fragment
        or parsed.path not in ("", "/")
    ):
        raise ValueError("HMB_URL must be an HTTP URL on a loopback host")
    return raw.rstrip("/") + "/api/status"


def _status(_params, **_kwargs):
    try:
        opener = build_opener(_NoRedirect())
        with opener.open(_status_url(), timeout=2) as response:
            if response.status != 200:
                raise URLError(f"preview returned HTTP {response.status}")
            payload = json.loads(response.read(8193))
        return json.dumps({"ok": True, "status": payload})
    except (OSError, ValueError, URLError, json.JSONDecodeError) as exc:
        return json.dumps({"ok": False, "error": str(exc)[:240]})


def register(ctx):
    """Register the sole read-only status tool with Hermes."""
    ctx.register_tool(
        name="hmb_status",
        toolset="holdmybeer",
        schema={
            "name": "hmb_status",
            "description": "Read status from a running local HoldMyBeer preview. This does not start or configure the preview.",
            "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
        },
        handler=_status,
    )
    skill_path = os.path.join(os.path.dirname(__file__), "skills", "teach-workflow", "SKILL.md")
    if hasattr(ctx, "register_skill"):
        ctx.register_skill("teach-workflow", skill_path)
