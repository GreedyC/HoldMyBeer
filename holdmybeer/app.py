from __future__ import annotations

import json
import os
import re
import sqlite3
import threading
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field, StrictInt, field_validator

VERSION = "0.1.0"
MAX_MEDIA_BYTES = 100 * 1024 * 1024
DATA_DIR = Path(os.environ.get("HMB_DATA_DIR", "~/.local/share/holdmybeer")).expanduser().resolve()
FIXTURE_HTML = (Path(__file__).resolve().parent.parent / "web" / "fixture.html").read_text()


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CreateSession(StrictModel):
    title: str = Field(min_length=1, max_length=200)


class ProcedureStep(StrictModel):
    goal: str = Field(min_length=1, max_length=500)
    check: str = Field(min_length=1, max_length=1000)


class Procedure(StrictModel):
    revision: StrictInt = Field(ge=1)
    steps: list[ProcedureStep] = Field(max_length=20)


class UpdateSession(StrictModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    notes: str | None = Field(default=None, max_length=20_000)
    answers: dict[str, str] | None = Field(default=None, max_length=50)
    procedure: Procedure | None = None

    @field_validator("answers")
    @classmethod
    def validate_answers(cls, answers):
        if answers is not None and any(not key.strip() or len(key) > 100 or len(value) > 2000 for key, value in answers.items()):
            raise ValueError("answer keys must be 1-100 characters and values at most 2000 characters")
        return answers


class RunInput(StrictModel):
    caption: str = Field(min_length=1, max_length=2000)
    filename: str = Field(min_length=1, max_length=255)
    variant: str = Field(pattern="^(normal|changed)$")
    repair: bool


class DraftInput(StrictModel):
    caption: str = Field(min_length=1, max_length=2000)
    filename: str = Field(min_length=1, max_length=255)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_filename(value: str) -> str:
    if value in {".", ".."} or Path(value).name != value or "\x00" in value:
        raise HTTPException(422, "filename must be a plain filename")
    return value


class Store:
    def __init__(self, root: Path):
        self.root = root
        self.artifacts = (root / "artifacts").resolve()
        self.artifacts.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.db_path = root / "holdmybeer.sqlite3"
        root.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.lock = threading.RLock()
        with self.connect() as db:
            db.executescript("""
            CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, data TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY, session_id TEXT NOT NULL, data TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS drafts(id TEXT PRIMARY KEY, data TEXT NOT NULL);
            """)

    def connect(self):
        db = sqlite3.connect(self.db_path, timeout=10)
        db.row_factory = sqlite3.Row
        return db

    def get_session(self, ident: str) -> dict:
        with self.connect() as db:
            row = db.execute("SELECT data FROM sessions WHERE id=?", (ident,)).fetchone()
        if not row: raise HTTPException(404, "session not found")
        data = json.loads(row[0])
        with self.connect() as db:
            data["runs"] = [json.loads(r[0]) for r in db.execute("SELECT data FROM runs WHERE session_id=? ORDER BY rowid", (ident,))]
        return data

    def save_session(self, data: dict):
        with self.connect() as db:
            db.execute("INSERT OR REPLACE INTO sessions(id,data) VALUES(?,?)", (data["id"], json.dumps(data)))

    def save_run(self, sid: str, data: dict):
        with self.connect() as db:
            db.execute("INSERT INTO runs(id,session_id,data) VALUES(?,?,?)", (data["id"], sid, json.dumps(data)))

    def save_draft(self, data: dict):
        with self.connect() as db:
            db.execute("INSERT INTO drafts(id,data) VALUES(?,?)", (data["id"], json.dumps(data)))

    def drafts(self):
        with self.connect() as db:
            return [json.loads(r[0]) for r in db.execute("SELECT data FROM drafts ORDER BY rowid")]


def create_app(data_dir: Path | None = None) -> FastAPI:
    app = FastAPI(title="HoldMyBeer", docs_url=None, redoc_url=None)
    app.state.store = Store((data_dir or DATA_DIR).resolve())
    app.state.runner_lock = threading.Lock()

    @app.middleware("http")
    async def local_only(request: Request, call_next):
        host_header = request.headers.get("host", "")
        host = (urlsplit("//" + host_header).hostname or "").lower()
        if host not in {"localhost", "127.0.0.1", "::1", "testserver"}:
            return Response("local Host required", status_code=400)
        origin = request.headers.get("origin")
        if origin:
            parsed = urlsplit(origin)
            request_url = request.url
            try:
                origin_port = parsed.port or (443 if parsed.scheme == "https" else 80)
                request_port = request_url.port or (443 if request_url.scheme == "https" else 80)
            except ValueError:
                return Response("invalid Origin or Host", status_code=403)
            if (parsed.scheme != request_url.scheme or parsed.hostname not in {"localhost", "127.0.0.1", "::1"}
                    or parsed.hostname != (request_url.hostname or "").lower() or origin_port != request_port
                    or parsed.username or parsed.password or parsed.path not in {"", "/"} or parsed.query or parsed.fragment):
                return Response("foreign Origin rejected", status_code=403)
        peer = request.client.host if request.client else "127.0.0.1"
        if peer not in {"127.0.0.1", "::1", "testclient"}:
            return Response("loopback clients only", status_code=403)
        return await call_next(request)

    @app.get("/api/status")
    def status(): return {"version": VERSION, "analysis": "manual", "runner": "bundled-browser", "hermes": "scaffold"}

    @app.get("/api/sessions")
    def list_sessions():
        with app.state.store.connect() as db:
            return {"sessions": [app.state.store.get_session(r[0]) for r in db.execute("SELECT id FROM sessions ORDER BY rowid DESC")]}

    @app.post("/api/sessions")
    def create_session(body: CreateSession):
        data = {"id": str(uuid.uuid4()), "title": body.title.strip(), "created_at": _now(), "notes": "", "answers": {},
                "procedure": {"revision": 1, "steps": []}, "media_url": None, "runs": []}
        if not data["title"]: raise HTTPException(422, "title cannot be blank")
        app.state.store.save_session(data)
        return data

    @app.get("/api/sessions/{session_id}")
    def get_session(session_id: str): return app.state.store.get_session(session_id)

    @app.put("/api/sessions/{session_id}")
    def update_session(session_id: str, body: UpdateSession):
        data = app.state.store.get_session(session_id)
        patch = body.model_dump(exclude_unset=True)
        for key, value in patch.items():
            if value is not None: data[key] = value
        app.state.store.save_session({k: v for k, v in data.items() if k != "runs"})
        return app.state.store.get_session(session_id)

    @app.post("/api/sessions/{session_id}/media")
    async def upload_media(session_id: str, request: Request):
        data = app.state.store.get_session(session_id)
        ctype = request.headers.get("content-type", "").split(";", 1)[0].lower()
        if ctype not in {"video/webm", "video/mp4"}: raise HTTPException(415, "video/webm or video/mp4 required")
        length = request.headers.get("content-length")
        if length and (not length.isdigit() or int(length) > MAX_MEDIA_BYTES): raise HTTPException(413, "media too large")
        suffix = ".mp4" if ctype == "video/mp4" else ".webm"
        target = (app.state.store.artifacts / (session_id + suffix)).resolve()
        if target.parent != app.state.store.artifacts: raise HTTPException(400, "unsafe media path")
        alternate = (app.state.store.artifacts / (session_id + (".webm" if suffix == ".mp4" else ".mp4"))).resolve()
        fd, temp_name = tempfile.mkstemp(prefix=f".{session_id}.", suffix=".upload", dir=app.state.store.artifacts)
        temp = Path(temp_name)
        total = 0
        try:
            with os.fdopen(fd, "wb") as out:
                async for chunk in request.stream():
                    total += len(chunk)
                    if total > MAX_MEDIA_BYTES: raise HTTPException(413, "media too large")
                    out.write(chunk)
                out.flush()
                os.fsync(out.fileno())
            if total == 0: raise HTTPException(422, "empty media")
            os.replace(temp, target)
            if alternate.parent == app.state.store.artifacts: alternate.unlink(missing_ok=True)
        finally:
            temp.unlink(missing_ok=True)
        data["media_url"] = f"/api/sessions/{session_id}/media"
        app.state.store.save_session({k: v for k, v in data.items() if k != "runs"})
        return {"url": data["media_url"]}

    @app.get("/api/sessions/{session_id}/media")
    def get_media(session_id: str):
        app.state.store.get_session(session_id)
        candidates = [(app.state.store.artifacts / (session_id + ext)).resolve() for ext in (".webm", ".mp4")]
        target = next((p for p in candidates if p.parent == app.state.store.artifacts and p.is_file()), None)
        if target is None: raise HTTPException(404, "media not found")
        return FileResponse(target, media_type="video/mp4" if target.suffix == ".mp4" else "video/webm")

    @app.get("/fixture", response_class=HTMLResponse)
    def fixture(): return FIXTURE_HTML

    @app.post("/api/fixture/drafts")
    def create_draft(body: DraftInput):
        filename = _safe_filename(body.filename)
        data = {"id": str(uuid.uuid4()), "caption": body.caption, "filename": filename}
        app.state.store.save_draft(data)
        return data

    @app.get("/api/fixture/drafts")
    def list_drafts(): return {"drafts": app.state.store.drafts()}

    @app.get("/api/artifacts/{run_id}.png")
    def screenshot(run_id: str):
        if not re.fullmatch(r"[0-9a-f-]{36}", run_id): raise HTTPException(404, "artifact not found")
        path = (app.state.store.artifacts / f"{run_id}.png").resolve()
        if path.parent != app.state.store.artifacts or not path.is_file(): raise HTTPException(404, "artifact not found")
        return FileResponse(path, media_type="image/png")

    @app.post("/api/sessions/{session_id}/run")
    def run_session(session_id: str, body: RunInput, request: Request):
        session = app.state.store.get_session(session_id)
        filename = _safe_filename(body.filename)
        run = {"id": str(uuid.uuid4()), "status": "failed", "revision": session["procedure"]["revision"], "caption": body.caption,
               "filename": filename, "steps": [], "failure": None, "screenshot_url": None, "draft_id": None}
        if not app.state.runner_lock.acquire(blocking=False): raise HTTPException(429, "a browser run is already active")
        try:
            try:
                from .runner import execute
                result = execute(f"http://127.0.0.1:{request.scope["server"][1]}", app.state.store.artifacts, run["id"], body.caption, filename, body.variant, body.repair)
                run.update(result)
            except Exception as exc:
                run["failure"] = (str(exc) or type(exc).__name__)[:500]
        finally:
            app.state.runner_lock.release()
        app.state.store.save_run(session_id, run)
        return run

    @app.get("/api/sessions/{session_id}/runs/{run_id}")
    def get_run(session_id: str, run_id: str):
        session = app.state.store.get_session(session_id)
        for run in session["runs"]:
            if run["id"] == run_id: return run
        raise HTTPException(404, "run not found")

    web_dir = Path(__file__).resolve().parent.parent / "web"
    if web_dir.is_dir() and any(web_dir.iterdir()): app.mount("/", StaticFiles(directory=web_dir, html=True), name="web")
    return app


app = create_app()
