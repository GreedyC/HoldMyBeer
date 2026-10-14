# HoldMyBeer

**Teach your agent by showing it.**

The goal: show an app workflow, let the agent ask questions, then watch it try and improve from your corrections. This first prototype supplies the recording workspace and a reproducible trial engine. HoldMyBeer is an early plugin/skill project for teaching and checking browser workflows with the agent you already use. The shared engine is intended to support MCP-compatible clients such as Codex, Claude Code and editor integrations; Hermes is the first adapter. Those additional client integrations are planned, not yet verified.

## What works today

- Screen-capture controls using the browser picker (window/tab choice needs a manual compatibility check); verified video import and playback.
- Manual teaching notes, questions, and editable procedure steps.
- A real Playwright browser trial that runs a fixed practice routine, checks the saved draft, and retains screenshots. Changed controls stop for a reviewed repair.
- Saved trial history and teaching notes. Edited procedures are not yet executable.

The preview does **not** use AI inference or analyze video with AI, publish to social networks, or provide a production Hermes installation. Hermes support is an opt-in scaffold with one read-only status tool. The runner exercises the bundled fixture; it does not automate arbitrary websites.

## Try the local preview

Requires Python 3.10+. Use a virtual environment. From a source checkout, install its dependencies and browser:

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -e '.[test]'
python3 -m playwright install chromium
python3 -m uvicorn holdmybeer.app:app --host 127.0.0.1 --port 18940
```

The documented preview path is an editable source checkout. A built wheel is not currently documented or verified to include the web assets or Hermes scaffold.

Open <http://127.0.0.1:18940>. Data is stored outside the repository under `~/.local/share/holdmybeer` by default; set `HMB_DATA_DIR` to choose another private local directory. Browser capture may require a secure context; use localhost as shown.

## Contribute

Bug reports, task ideas, documentation edits, and carefully sanitized reproduction notes are welcome. You do not need to be a programmer. Start with [CONTRIBUTING.md](CONTRIBUTING.md), browse the [starter issue drafts](docs/LAUNCH.md), or choose a small task from [the roadmap](docs/ROADMAP.md).

Before sharing evidence, remove personal recordings, account names, private URLs, cookies, tokens, and customer data. Never commit captured media or runtime artifacts.

## Project status

This is an experimental preview. See [DEVELOPER.md](DEVELOPER.md) for the current shape, [SECURITY.md](SECURITY.md) for local-data boundaries, and [LICENSE](LICENSE) for the license.

## Help build the actual teaching loop

The next substantial contributions are timestamped browser observations, bounded vision analysis through Hermes, and compiling reviewed teaching notes into executable procedures. Start with the [architecture contract](docs/CONTRACT.md) and [contribution guide](CONTRIBUTING.md). No fine-tuning is required: the reusable artifact is a tested procedure.

See [verified preview evidence](docs/VERIFICATION.md).
