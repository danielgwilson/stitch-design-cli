---
name: stitch
description: |
  Use this skill whenever you need to inspect or mutate Google Stitch projects and screens via the official SDK-backed `stitch` CLI.
  Triggers include: listing Stitch projects, creating a project, listing or inspecting screens, generating a screen from text, editing a screen, checking Stitch auth, or using Stitch without keeping MCP mounted in the active tool loop.
---

# Stitch (agent-first CLI)

Use this skill when the task touches Google Stitch projects, screens, or auth state and a local CLI is preferable to active MCP wiring.

Important naming detail:

- npm package name: `stitch-design-cli`
- CLI binary name: `stitch`

Resolution order:

1. If `stitch` is already on `$PATH`, use it directly.
2. Otherwise run the published package explicitly with `npx -y stitch-design-cli <args>`.

Do not guess alternate package names.

Default stance:

- Prefer the official SDK-backed `stitch` CLI, not browser automation.
- Prefer `--json` for machine-readable output.
- Prefer read-only inspection before generating or editing screens.
- Use Stitch MCP directly only when a task specifically needs always-on tool use or lower-level surface area than this CLI exposes.

## Default workflow

- If auth is missing, run `stitch auth set`
- Sanity check auth: `stitch doctor --json`
- Inspect auth state: `stitch auth status --json`
- List tools: `stitch tool list --json`
- List projects: `stitch project list --json`
- Create a project: `stitch project create --title "Design Sandbox" --json`
- List screens: `stitch screen list --project-id <project-id> --json`
- Inspect a screen: `stitch screen get --project-id <project-id> --screen-id <screen-id> --include-image --json`
- Generate a screen: `stitch screen generate --project-id <project-id> --prompt "..." --device-type DESKTOP --json`
- Edit a screen: `stitch screen edit --project-id <project-id> --screen-id <screen-id> --prompt "..." --json`
- Generate variants: `stitch screen variants --project-id <project-id> --screen-id <screen-id> --prompt "..." --variant-count 3 --creative-range EXPLORE --json`

For the common design-iteration flow, the default sequence is:

1. `stitch doctor --json`
2. `stitch project list --json`
3. `stitch screen list --project-id <project-id> --json`
4. `stitch screen get --project-id <project-id> --screen-id <screen-id> --include-image --json`
5. `stitch screen edit --project-id <project-id> --screen-id <screen-id> --prompt "..." --json`
6. `stitch screen variants --project-id <project-id> --screen-id <screen-id> --prompt "..." --variant-count 3 --json`

## Auth

The CLI supports both auth modes exposed by the official Stitch SDK:

- API key
- OAuth access token plus project id

If `stitch doctor --json` reports missing auth:

- Best interactive path: `stitch auth set`
- Best ephemeral path: `STITCH_API_KEY=... stitch doctor --json`
- Saved local config: `printf '%s' "$STITCH_API_KEY" | stitch auth set --stdin`
- OAuth local config: `stitch auth set --access-token "$STITCH_ACCESS_TOKEN" --project-id "$GOOGLE_CLOUD_PROJECT"`
- OAuth env path: `STITCH_ACCESS_TOKEN=... GOOGLE_CLOUD_PROJECT=... stitch doctor --json`

Avoid pasting full keys into logs or chat.

## Quick verification

If you are unsure which invocation path works in the current shell:

```bash
command -v stitch >/dev/null 2>&1 && stitch doctor --json || npx -y stitch-design-cli doctor --json
```

## Important constraints

- v1 covers project and screen flows only.
- Do not assume design-system operations are exposed yet.
- Do not assume screenshot-upload seeding is exposed yet.
- `project get` is wired to the official `get_project` tool.
- `screen edit` and `screen variants` both support multiple `--screen-id` values.
- Before editing a screen, confirm the project id and screen id.

## Contract

Stable JSON behavior is documented in `docs/CONTRACT_V1.md`.
