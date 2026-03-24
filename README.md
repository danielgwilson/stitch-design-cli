# stitch-design-cli

Agent-first CLI for Google's official Stitch SDK.

This package is meant for the workflow where active MCP wiring is overkill, but a stable local command surface is still useful for agents and operators.

## Why this exists

Google Stitch officially exposes:

- a remote MCP server
- an official JavaScript SDK, `@google/stitch-sdk`

What it does not currently expose is a standalone generic local CLI with:

- explicit auth setup
- predictable JSON envelopes
- stderr/stdout discipline for agents
- a small command surface for common project and screen workflows

This package fills that gap without leaving the official platform surface.

## Install

```bash
npm install -g stitch-design-cli
```

Or run it without installing:

```bash
npx -y stitch-design-cli doctor --json
```

## Auth

The recommended v1 path is API key auth.

Save a key locally:

```bash
stitch auth set
```

Pipe a key from stdin:

```bash
printf '%s' "$STITCH_API_KEY" | stitch auth set --stdin
```

Or use env directly:

```bash
export STITCH_API_KEY=...
stitch doctor --json
```

Optional env/config knobs:

- `STITCH_API_KEY`
- `STITCH_HOST`
- `STITCH_TIMEOUT_MS`
- `STITCH_ACCESS_TOKEN`
- `GOOGLE_CLOUD_PROJECT`

## Common commands

```bash
stitch auth status --json
stitch doctor --json
stitch tool list --json
stitch project list --json
stitch project create --title "Design Sandbox" --json
stitch project get <project-id> --json
stitch screen list --project-id <project-id> --json
stitch screen get --project-id <project-id> --screen-id <screen-id> --include-image --json
stitch screen generate --project-id <project-id> --prompt "A landing page for a healthcare startup" --device-type DESKTOP --include-image --json
stitch screen edit --project-id <project-id> --screen-id <screen-id> --prompt "Make the hero more editorial" --json
stitch screen variants --project-id <project-id> --screen-id <screen-id> --prompt "Explore three lighter brand directions" --variant-count 3 --creative-range EXPLORE --aspect COLOR_SCHEME --aspect LAYOUT --json
```

## Design notes

- `project get` calls the official `get_project` tool directly.
- `screen get` can optionally include HTML and screenshot artifact URLs.
- `screen edit` and `screen variants` accept repeated `--screen-id` flags or comma-separated values.
- v1 intentionally stops before design-system and upload flows.

## Contract

Stable machine-readable behavior is documented in [docs/CONTRACT_V1.md](./docs/CONTRACT_V1.md).

## Release hygiene

- CI workflow: `.github/workflows/ci.yml`
- publish workflow: `.github/workflows/publish.yml`
- trusted publishing notes: `stitch-trusted-publishing-notes.md`
