# Local teaching contract

The FastAPI workspace binds to loopback. Runtime media, SQLite data, proposals and screenshots stay outside the source checkout under `HMB_DATA_DIR` (default `~/.local/share/holdmybeer`). The stdio MCP process uses that same directory; it does not start the workspace.

## Workspace API

- `GET /api/status`: current capability labels.
- `GET/POST /api/sessions`: list/create workflows.
- `GET/PUT /api/sessions/{id}`: retrieve or update title, notes, answers and procedure.
- `POST /api/sessions/{id}/media`: atomic bounded WebM/MP4 upload (100 MiB maximum).
- `GET /api/sessions/{id}/media`: retained video.
- `GET /api/sessions/{id}/proposal`: latest valid agent proposal, or `null`; never applies it.
- `POST /api/sessions/{id}/run`: caption, plain filename, normal/changed fixture variant, legacy repair flag, and mode `practice` (legacy default) or `procedure`.
- `GET /api/sessions/{id}/runs/{run_id}`: retained run and procedure snapshot.
- `GET /api/artifacts/{run_id}.png`: retained screenshot.
- `GET /fixture`: draft practice app; `?embedded=1` hides standalone navigation.
- `GET/POST /api/fixture/drafts`: retained fixture drafts.

Unknown fields, missing IDs and invalid targets are rejected. Origins must match the loopback request's scheme/host/port. Only one browser trial runs at a time.

## Procedure and execution

A procedure has a positive integer `revision` and at most 20 steps. Every step has bounded text `goal` and `check`. Notes-only steps remain readable for older sessions. Executable fixture mode requires exactly these four steps:

| action | target | input |
| --- | --- | --- |
| upload | exact accessible input label | filename |
| fill | exact accessible input label | caption |
| click | exact accessible button name | absent |
| verify_draft | absent | absent |

Actions execute in saved order against the bundled fixture. No arbitrary URL, selector, JavaScript or shell command is accepted. Fresh inputs are substituted at execution time. `check` documents expected evidence; it is not evaluated as executable text. Verification compares the returned draft ID and both fresh inputs with retained API storage.

Missing targets stop with `needs_teaching`; no alternate locator is guessed. The repair flag is ignored in procedure mode. A run retains the exact procedure snapshot, mode, revision, steps, failure, draft ID and screenshot URL. Changing saved actions does not alter earlier evidence. Browser interactions have time limits; there is no mid-run cancellation interface yet.

The UI invalidates its review checkbox when actions change. Saving a changed procedure advances its revision. A user then explicitly authorizes a local trial. The API remains a local developer interface; callers can explicitly request a run. The MCP bridge has no execution tool.

## Agent teaching bridge

`hmb_list_sessions`, `hmb_get_session`, and `hmb_recording_frames` read bounded local evidence. Frame inspection accepts 1–6 finite timestamps and returns timestamp-labelled images scaled within 1280 × 720. Local ffprobe/ffmpeg use file/pipe protocols only and bounded subprocess work. A packet scan handles MediaRecorder WebM with missing duration metadata.

`hmb_propose_teaching` validates up to six timestamped observations, six questions and an executable procedure. It atomically writes a separate private proposal file. It cannot replace the reviewed session or execute anything. The workspace loads the latest proposal only when requested, displays observations/questions/actions, and waits for review.

User answers remain bounded strings. Agent question/observation bundles may use up to 4000 characters; individual answers remain limited to 2000. Selected frames and session text returned through MCP enter the host agent's conversation and follow that host's data handling. HoldMyBeer runs no internal model and makes no independent remote inference requests.

The native Hermes scaffold is separate and status-only. See [client configuration examples](CLIENTS.md) for the shared bridge. Client examples are not end-to-end installation receipts.
