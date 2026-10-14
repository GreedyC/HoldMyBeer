# Preview contract v0.1

Local-only FastAPI server, static web UI; no external account actions.
Runtime data outside repository via HMB_DATA_DIR, default ~/.local/share/holdmybeer.
Capture media uses user's browser getDisplayMedia, saved locally after explicit action.

Routes:

- GET /api/status -> {version, analysis:"manual", runner:"bundled-browser", hermes:"scaffold"}
- GET /api/sessions -> {sessions:[session]}
- POST /api/sessions {title} -> session
- GET /api/sessions/{id} -> session
- PUT /api/sessions/{id} {notes?, answers?, procedure?} -> session
- POST /api/sessions/{id}/media raw video body, content-type video/webm or video/mp4 -> {url}
- GET /api/sessions/{id}/media -> video bytes
- POST /api/sessions/{id}/run {caption,filename,variant:"normal"|"changed", repair:false|true} -> run
- GET /api/sessions/{id}/runs/{run_id} -> run
- GET /fixture -> browser fixture page
- POST /api/fixture/drafts {caption,filename} -> {id,caption,filename}
- GET /api/fixture/drafts -> {drafts:[...]}

Session: {id,title,created_at,notes:"",answers:{},procedure:{revision:1,steps:[{goal,check}]},media_url:null,runs:[]}
Run: {id,status:"verified"|"needs_teaching"|"failed",revision,caption,filename,steps:[{goal,status,evidence}],failure:null|str,screenshot_url:null|str,draft_id:null|str}
Run implementation actually opens the bundled browser fixture with Playwright, supplies a file using upload, fills caption, saves draft and verifies the retained draft. Changed variant changes accessible button name. Repair flag chooses reviewed changed locator. No AI claims. Return bounded errors when browser unavailable.
GET /api/artifacts/{run_id}.png -> screenshot if retained.
UI uses editable question answers and manual procedure notes; no pretend AI responses. Imported video and captured video are real media.
No personal recordings in git. API rejects unknown keys/IDs, bounds media size, and confines files to private artifact directory. Loopback-only preview, reject foreign Origin headers and non-local Host headers. Serialize browser runs to prevent collisions. Runner is synchronous bounded (<30s) in this preview.

Ownership: Luna backend owns holdmybeer/** and tests/**. Luna docs owns README, LICENSE, CONTRIBUTING, SECURITY, DEVELOPER, plugin.yaml, **init**.py, pyproject.toml, skills/**, .github/**, docs/ROADMAP.md. Parent owns web/\*\*, docs/CONTRACT.md and integration. No touching others' files, no new subagents, no deployment.
