# Contributing

Thanks for helping make workflow teaching clearer and safer. Small, focused contributions are easiest to review.

## You do not need to code

You can suggest a realistic task for the bundled fixture, improve a confusing instruction, report an accessibility issue, or review whether a procedure says what a person actually did. Use a GitHub issue when available, or send a proposed wording change as a pull request. Please say what you expected and what happened.

## For code changes

1. Open an issue or describe the problem in the pull request. Ready-to-adapt starter issue text is in [docs/LAUNCH.md](docs/LAUNCH.md).
2. Keep changes narrow and preserve the local-only boundary.
3. From a source checkout, install with `python3 -m pip install -e '.[test]'` and run `python3 -m pytest` plus `python3 -m compileall -q holdmybeer __init__.py` when relevant.
4. Include the result and any steps a reviewer needs to reproduce it.

Do not include recordings, screenshots containing private information, real account access, credentials, or customer data. Redact hostnames, email addresses, tokens, and private URLs from logs. Use the bundled fixture for examples.
