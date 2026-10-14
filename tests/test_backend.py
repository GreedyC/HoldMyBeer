import socket
import threading
import time

import httpx
import pytest
import uvicorn

import holdmybeer.app as backend
from holdmybeer.app import create_app


@pytest.fixture
def server(tmp_path):
    app = create_app(tmp_path / "data")
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    config = uvicorn.Config(app, log_level="error", lifespan="off")
    instance = uvicorn.Server(config)
    thread = threading.Thread(target=instance.run, kwargs={"sockets": [sock]}, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{port}"
    for _ in range(100):
        try:
            if httpx.get(base + "/api/status", timeout=.2).status_code == 200: break
        except Exception: time.sleep(.03)
    else: pytest.fail("local test server did not start")
    yield base, tmp_path / "data"
    instance.should_exit = True
    thread.join(timeout=3)
    sock.close()


def test_sessions_persist_and_unknown_ids_are_rejected(server):
    base, data_dir = server
    created = httpx.post(base + "/api/sessions", json={"title": "Printer test"}).json()
    updated = httpx.put(base + f"/api/sessions/{created['id']}", json={"notes": "first observation", "answers": {"noise": "steady"}})
    assert updated.status_code == 200
    restarted = create_app(data_dir)
    # A separate app instance opens the same on-disk store.
    assert restarted.state.store.get_session(created["id"])["notes"] == "first observation"
    assert httpx.get(base + "/api/sessions/not-a-session").status_code == 404
    assert httpx.get(base + f"/api/sessions/{created['id']}/runs/not-a-run").status_code == 404
    assert httpx.post(base + "/api/sessions", json={"title": "x", "surprise": True}).status_code == 422
    assert httpx.put(base + f"/api/sessions/{created['id']}", json={"procedure": {"revision": 0, "steps": []}}).status_code == 422
    assert httpx.put(base + f"/api/sessions/{created['id']}", json={"procedure": {"revision": True, "steps": []}}).status_code == 422
    assert httpx.put(base + f"/api/sessions/{created['id']}", json={"procedure": {"revision": 1, "steps": [{"goal": "click", "check": "saved", "action": "publish"}]}}).status_code == 422
    assert httpx.put(base + f"/api/sessions/{created['id']}", json={"answers": {"q": "x" * 2001}}).status_code == 422
    good_procedure = {"revision": 2, "steps": [{"goal": "Save draft", "check": "Draft id appears"}]}
    assert httpx.put(base + f"/api/sessions/{created['id']}", json={"procedure": good_procedure}).status_code == 200


def test_media_is_bounded_and_origin_is_local_only(server, monkeypatch):
    base, _ = server
    session = httpx.post(base + "/api/sessions", json={"title": "Capture"}).json()
    assert httpx.post(base + f"/api/sessions/{session['id']}/media", content=b"x", headers={"Content-Type": "image/png"}).status_code == 415
    foreign = httpx.get(base + "/api/status", headers={"Origin": "https://evil.example"})
    assert foreign.status_code == 403
    another_local_port = httpx.get(base + "/api/status", headers={"Origin": "http://127.0.0.1:1234"})
    assert another_local_port.status_code == 403
    malformed_origin = httpx.get(base + "/api/status", headers={"Origin": "http://127.0.0.1:bad"})
    assert malformed_origin.status_code == 403
    assert httpx.get(base + "/api/status", headers={"Host": "evil.example"}).status_code == 400
    media_url = base + f"/api/sessions/{session['id']}/media"
    headers = {"Content-Type": "video/webm"}
    uploaded = httpx.post(media_url, content=b"original", headers=headers)
    assert uploaded.status_code == 200
    assert httpx.post(media_url, content=b"", headers=headers).status_code == 422
    monkeypatch.setattr(backend, "MAX_MEDIA_BYTES", 4)
    assert httpx.post(media_url, content=b"too large", headers=headers).status_code == 413
    assert httpx.get(media_url).content == b"original"


def test_real_browser_normal_changed_and_repaired_runs(server):
    base, _ = server
    session = httpx.post(base + "/api/sessions", json={"title": "Fixture exercise"}).json()
    fixture = httpx.get(base + "/fixture?variant=changed").text
    assert "Store draft" in fixture
    assert "Publish now" not in fixture
    normal = httpx.post(base + f"/api/sessions/{session['id']}/run", json={"caption": "A test caption", "filename": "input.mp4", "variant": "normal", "repair": False}).json()
    assert normal["status"] == "verified", normal
    assert normal["draft_id"]
    assert httpx.get(base + normal["screenshot_url"]).headers["content-type"] == "image/png"

    changed = httpx.post(base + f"/api/sessions/{session['id']}/run", json={"caption": "Changed label", "filename": "input.mp4", "variant": "changed", "repair": False}).json()
    assert changed["status"] == "needs_teaching", changed

    repaired = httpx.post(base + f"/api/sessions/{session['id']}/run", json={"caption": "Repaired label", "filename": "input.mp4", "variant": "changed", "repair": True}).json()
    assert repaired["status"] == "verified", repaired
    drafts = httpx.get(base + "/api/fixture/drafts").json()["drafts"]
    assert {normal["draft_id"], repaired["draft_id"]} <= {draft["id"] for draft in drafts}
