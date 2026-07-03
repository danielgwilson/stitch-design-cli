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

## Skill Install

Install the agent skill from the canonical nested skill path:

```bash
npx -y skills add -g danielgwilson/stitch-design-cli --skill stitch
```

The skill lives at `skills/stitch/SKILL.md`; the package does not ship a duplicate root `SKILL.md`.

## Auth

The CLI supports both auth modes exposed by the official Stitch SDK:

- API key
- OAuth access token plus project id

For repeated use, save credentials locally. The API key path can prompt interactively:

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

For OAuth, prefer env vars for ephemeral use so the access token does not appear in shell history or process arguments:

```bash
export STITCH_ACCESS_TOKEN=...
export GOOGLE_CLOUD_PROJECT=...
stitch doctor --json
```

For local OAuth config, use the CLI only in a private shell and avoid writing tokens into logs, docs, or chat.

If `tool list` works but `project list` fails with `AUTH_FAILED`, the configured credentials reached Stitch but were rejected for project access. In that case, rotate the API key or switch to OAuth.

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
stitch screen get --project-id <project-id> --screen-id <screen-id-a> --screen-id <screen-id-b> --include-image --include-html --json
stitch screen generate --project-id <project-id> --prompt "A landing page for a healthcare startup" --device-type DESKTOP --include-image --json
stitch screen edit --project-id <project-id> --screen-id <screen-id> --prompt "Make the hero more editorial" --json
stitch screen variants --project-id <project-id> --screen-id <screen-id> --prompt "Explore three lighter brand directions" --variant-count 3 --creative-range EXPLORE --aspect COLOR_SCHEME --aspect LAYOUT --json
```

## Design notes

- `project get` calls the official `get_project` tool directly.
- `screen get` can optionally include HTML and screenshot artifact URLs, and accepts repeated `--screen-id` flags for batch retrieval.
- `screen edit` and `screen variants` accept repeated `--screen-id` flags or comma-separated values.
- `screen variants` now returns explicit follow-up screen IDs plus a ready-to-run `screen get` command, which is useful when project inventory lags behind fresh variants.
- v1 intentionally stops before design-system and upload flows.

## Contract

Stable machine-readable behavior is documented in [docs/CONTRACT_V1.md](./docs/CONTRACT_V1.md).

## Release hygiene

- CI workflow: `.github/workflows/ci.yml`
- publish workflow: `.github/workflows/publish.yml`
- local release gate: `npm run check:release`
- trusted publishing notes: `stitch-trusted-publishing-notes.md`
