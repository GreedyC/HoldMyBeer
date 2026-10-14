# Developer guide

## Local teaching engine

FastAPI serves the same-page recording/practice workspace on loopback:

```bash
python3 -m uvicorn holdmybeer.app:app --host 127.0.0.1 --port 18940
```

Runtime recordings, proposals, SQLite data and screenshots belong outside the checkout under `HMB_DATA_DIR` (default `~/.local/share/holdmybeer`). No Printery service, LAN URL or managed deployment is configured by this repo. The current interface contract is [docs/CONTRACT.md](docs/CONTRACT.md).

`holdmybeer/models.py` owns shared procedure validation. Saved executable fixture actions drive procedure trials with supplied captions and new or reused fixture media. Runs snapshot the exact procedure revision so later corrections cannot alter earlier evidence. Notes-only legacy sessions remain readable; legacy practice mode remains available through the API. The UI uses procedure mode and requires review.

`proposals.py` writes separate review-only files. `GET /api/sessions/{id}/proposal` returns the latest valid proposal without applying it. Loading, saving a reviewed revision and running are separate user actions. Agent questions/observations and user answers persist in bounded answer bundles. The original recording stays intact.

`web/fixture.html` supplies sample-file selection, validation, a readable saved receipt and a retained draft list. Embedded mode hides standalone navigation. The runner reads output JSON only after the fixture verifies retention, and independently compares the draft ID, filename and caption with storage.

## MCP and clients

`holdmybeer-mcp` launches the official Python MCP SDK over stdio. It exposes bounded session reads, recording frames and a review-only proposal tool; there is no MCP execution tool. The host agent supplies vision and reasoning. Selected images returned to that host follow its model provider's data handling.

Frame inspection requires local `ffmpeg` and `ffprobe`. Decoding uses file/pipe protocols only, dimensions within 1280 × 720, finite timestamps, subprocess deadlines and a bounded packet-duration fallback for browser WebM without metadata. [docs/CLIENTS.md](docs/CLIENTS.md) contains configuration examples. Individual client installations and image understanding require separate receipts.

`skills/teach-workflow/SKILL.md` guides frame-grounded observations, questions, proposed actions and evidence review. No skill is installed automatically. `plugin.yaml` and root `__init__.py` remain a separate native Hermes status-only scaffold. Its `HMB_URL` accepts HTTP loopback URLs, refuses redirects and never starts or installs the preview. Production Hermes loading remains unverified.

## Packaging and checks

Install dependencies in a virtual environment with `python3 -m pip install -e '.[test]'` and install matching Chromium with `python3 -m playwright install chromium`. Runtime dependencies include FastAPI, Uvicorn, Playwright and MCP; tests use pytest/httpx and generated ffmpeg media.

Run `pytest -q`, `node --check web/app.js` and `python -m compileall -q holdmybeer`. Local browser acceptance used Playwright 1.62 with its matching installed browser. CI installs a matching browser for its resolved version.

`setup.py` copies canonical `web/` assets into `holdmybeer/web/` for wheels; `MANIFEST.in` includes assets in source distributions. The app resolves package assets first and source assets otherwise. `tests/wheel_smoke.py`, run with a separately installed wheel interpreter, verifies workspace assets, an actual reviewed browser trial and the four-tool MCP handshake. The native Hermes scaffold and teaching skill remain source-only.

This alpha executes only the bundled four-action fixture. Arbitrary websites, live publishing, mid-run cancellation, a managed production service and independent client/platform acceptance are unfinished. Track those gates in [docs/STATUS.md](docs/STATUS.md).

Developer README updated for the procedure, proposal, MCP and packaging interfaces.

## Blended media trials

`select_media` is the preferred first action and accepts new/reuse modes; legacy `upload` procedures remain valid. Reuse resolves a retained fixture draft ID, preserving its filename while reconstructing generated fixture bytes. Run input snapshots retain this distinction. Optional bounded batches run sequentially, retain individual receipts and stop on the first failed item. The workspace keeps one item as the default. This is fixture-only file reuse, not retained original media.
