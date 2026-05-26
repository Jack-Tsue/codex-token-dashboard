# Security Policy

## Local Data

Codex Token Dashboard reads local Codex files from `~/.codex` by default. These files can contain project paths, session names, model names, usage metadata, and other local context.

The dashboard does not intentionally transmit this data outside your machine. The default server binds to `127.0.0.1`.

## Reporting Issues

Please report security issues privately if possible. If private reporting is not available, open a GitHub issue with minimal reproduction details and avoid posting sensitive logs.

## Safe Usage

- Do not expose the dashboard host to a public network.
- Prefer the default `127.0.0.1` host.
- Review logs before sharing screenshots.
- Do not commit your `~/.codex` data to this repository.
