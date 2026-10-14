# Developer guide

## Current preview

The app is a local FastAPI service and static teaching interface. Its contract is in [docs/CONTRACT.md](docs/CONTRACT.md). Run it with:

```bash
python3 -m uvicorn holdmybeer.app:app --host 127.0.0.1 --port 18940
```

The supported instructions in this preview are for running directly from a source checkout. `pyproject.toml` declares project dependencies, but a built wheel has not been verified to contain the web assets or Hermes scaffold; do not present wheel installation as supported.

Screen capture is implemented with the browser picker but still needs a manual window-selection test. Video import and decoded playback were verified. Teaching answers and procedure notes are manual. The Playwright runner uses a fixed bundled-fixture routine and verifies the retained draft. It does not execute edited procedure notes. AI video analysis, general website automation, live social publishing, and production Hermes setup are not implemented.

Runtime files belong outside the checkout, in `HMB_DATA_DIR` or `~/.local/share/holdmybeer`. Keep personal media and account data out of commits and issue attachments.

## Hermes scaffold

`plugin.yaml` and `__init__.py` define an opt-in native Hermes plugin. Its sole `hmb_status` tool reads the local preview's `/api/status` endpoint. Configure `HMB_URL` only when needed; accepted URLs must use HTTP and a loopback host (`localhost`, `127.0.0.1`, or `::1`). The default is `http://127.0.0.1:18940`. The tool has a short timeout, refuses redirects, and returns an error if the preview is unavailable. It never starts or installs anything.

Hermes plugins run in-process with the user's permissions. The scaffold remains disabled unless the user explicitly enables it in Hermes. A successful import is not evidence that the preview is installed or that any other Hermes capability is available.

## Dependencies and checks

Runtime dependencies are FastAPI, Uvicorn, and Playwright. Test dependencies are pytest and httpx. From the source checkout, install with `python3 -m pip install -e '.[test]'`; install Chromium with `python3 -m playwright install chromium`.

Developer README updated for the preview interfaces and verified limits.
