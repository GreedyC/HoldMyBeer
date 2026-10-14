# Security

HoldMyBeer is an experimental local preview. Its server is intended to bind to loopback only. It stores recordings and workflow notes on the local machine; treat that directory as private. The default is `~/.local/share/holdmybeer`, configurable with `HMB_DATA_DIR`.

The Hermes scaffold exposes only a read-only status lookup over HTTP to a loopback address. It does not execute shell commands, launch the preview, publish content, or transmit recordings. Do not expose the preview server to a network or use it with sensitive recordings.

To report a security issue, use GitHub's private vulnerability reporting for this repository if available. Do not put exploit details, secrets, or personal recordings in a public issue. Include a concise impact description and a sanitized reproduction. If private reporting is unavailable, contact the repository maintainers privately before public disclosure.
