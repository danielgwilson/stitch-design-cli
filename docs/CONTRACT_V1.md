# Stitch CLI v1 contract (agent-first)

This document defines stable machine-readable behavior for the official-SDK-first Stitch CLI.

## Output rules

- When you pass `--json`, the command prints exactly one JSON object to stdout.
- Progress and status logs go to stderr.
- Mutation-style commands always print JSON to stdout when `--json` is passed:
  - `stitch auth set`
  - `stitch project create`
  - `stitch screen generate`
  - `stitch screen edit`

## JSON envelope

Success:

```json
{
  "ok": true,
  "data": {},
  "meta": {}
}
```

Failure:

```json
{
  "ok": false,
  "error": {
    "code": "AUTH_MISSING",
    "message": "No Stitch credentials. Run `stitch auth set` to save an API key locally, `stitch auth set --stdin` to pipe one in, or export `STITCH_API_KEY`.",
    "retryable": false
  },
  "meta": {}
}
```

`meta` is optional.

## Exit codes

- `0`: success
- `1`: request failure, upstream failure, failed checks, or not found
- `2`: user action required or invalid input

## Error codes

- `AUTH_MISSING`
- `AUTH_FAILED`
- `NOT_FOUND`
- `PERMISSION_DENIED`
- `RATE_LIMITED`
- `NETWORK_ERROR`
- `VALIDATION_ERROR`
- `CHECK_FAILED`
- `UNKNOWN_ERROR`

## Coverage boundary

Direct official SDK coverage:

- `tool list`
- `project list`
- `project create`
- `screen list`
- `screen get`
- `screen generate`

Direct official Stitch tool coverage:

- `project get`
- `screen edit`
- `screen variants`

Derived helpers built on top of official Stitch coverage:

- `auth status`
- `doctor`
- `screen get --include-html`
- `screen get --include-image`

## Command examples

### `stitch auth status --json`

```json
{
  "ok": true,
  "data": {
    "authMode": "apiKey",
    "source": "env",
    "hasApiKey": true,
    "apiKeyRedacted": "ABCD…WXYZ",
    "validation": {
      "ok": true,
      "sample": {
        "projectCount": 3
      }
    }
  }
}
```

### `stitch doctor --json`

```json
{
  "ok": true,
  "data": {
    "checks": [
      { "name": "auth.present", "ok": true },
      { "name": "api.tools.list", "ok": true, "detail": "10 tools" },
      { "name": "api.projects.list", "ok": true, "detail": "3 projects" }
    ]
  }
}
```

Failed checks:

```json
{
  "ok": false,
  "error": {
    "code": "CHECK_FAILED",
    "message": "One or more checks failed",
    "retryable": false
  },
  "meta": {
    "checks": [
      { "name": "auth.present", "ok": false, "detail": "..." }
    ]
  }
}
```

### `stitch project list --json`

```json
{
  "ok": true,
  "data": {
    "count": 2,
    "items": [
      {
        "id": "4044680601076201931",
        "projectId": "4044680601076201931",
        "title": "Design Sandbox",
        "data": {}
      }
    ]
  }
}
```

### `stitch project get <project-id> --json`

```json
{
  "ok": true,
  "data": {
    "id": "4044680601076201931",
    "projectId": "4044680601076201931",
    "title": "Design Sandbox",
    "data": {}
  }
}
```

### `stitch screen list --project-id <project-id> --json`

```json
{
  "ok": true,
  "data": {
    "projectId": "4044680601076201931",
    "count": 1,
    "items": [
      {
        "id": "5386498029230965127",
        "screenId": "5386498029230965127",
        "projectId": "4044680601076201931",
        "title": "Landing Page",
        "htmlUrl": null,
        "imageUrl": null,
        "data": {}
      }
    ]
  }
}
```

### `stitch screen get --project-id <project-id> --screen-id <screen-id-a> --screen-id <screen-id-b> --include-image --include-html --json`

When exactly one `--screen-id` is provided, `screen get` returns a single screen object. When multiple ids are provided, it returns a list envelope:

```json
{
  "ok": true,
  "data": {
    "projectId": "4044680601076201931",
    "count": 2,
    "items": [
      {
        "id": "5386498029230965127",
        "screenId": "5386498029230965127",
        "projectId": "4044680601076201931",
        "title": "Landing Page",
        "htmlUrl": "https://...",
        "imageUrl": "https://...",
        "data": {}
      }
    ]
  }
}
```

### `stitch screen generate --project-id <project-id> --prompt ... --include-image --json`

```json
{
  "ok": true,
  "data": {
    "kind": "generate",
    "projectId": "4044680601076201931",
    "count": 1,
    "messages": [],
    "items": [
      {
        "id": "5386498029230965127",
        "screenId": "5386498029230965127",
        "projectId": "4044680601076201931",
        "title": "Landing Page",
        "htmlUrl": null,
        "imageUrl": "https://...",
        "resultIndex": 1,
        "data": {}
      }
    ],
    "notes": [],
    "followUp": {
      "screenIds": ["5386498029230965127"],
      "getCommand": "stitch screen get --project-id 4044680601076201931 --screen-id 5386498029230965127 --include-html --include-image --json"
    }
  }
}
```

### `stitch screen edit --project-id <project-id> --screen-id <screen-id> --prompt ... --json`

```json
{
  "ok": true,
  "data": {
    "kind": "edit",
    "projectId": "4044680601076201931",
    "selectedScreenIds": ["5386498029230965127"],
    "count": 1,
    "messages": [],
    "items": [
      {
        "id": "654321",
        "screenId": "654321",
        "projectId": "4044680601076201931",
        "title": "Landing Page v2",
        "htmlUrl": null,
        "imageUrl": null,
        "resultIndex": 1,
        "data": {}
      }
    ],
    "notes": [],
    "followUp": {
      "screenIds": ["654321"],
      "getCommand": "stitch screen get --project-id 4044680601076201931 --screen-id 654321 --include-html --include-image --json"
    }
  }
}
```

### `stitch screen variants --project-id <project-id> --screen-id <screen-id> --prompt ... --variant-count 3 --json`

```json
{
  "ok": true,
  "data": {
    "kind": "variants",
    "projectId": "4044680601076201931",
    "selectedScreenIds": ["5386498029230965127"],
    "count": 3,
    "messages": [],
    "items": [
      {
        "id": "variant-1",
        "screenId": "variant-1",
        "projectId": "4044680601076201931",
        "title": "Landing Page Variant 1",
        "htmlUrl": null,
        "imageUrl": null,
        "resultIndex": 1,
        "variantIndex": 1,
        "sourceScreenId": "5386498029230965127",
        "data": {}
      }
    ],
    "notes": [
      "Returned screen IDs are authoritative even if project or screen listings lag behind."
    ],
    "followUp": {
      "screenIds": ["variant-1", "variant-2", "variant-3"],
      "getCommand": "stitch screen get --project-id 4044680601076201931 --screen-id variant-1 --screen-id variant-2 --screen-id variant-3 --include-html --include-image --json"
    }
  }
}
```
