---
title: API reference
description: HTTP API for programmatic access to oru tasks.
---

## Server setup

Start the HTTP server on the default port (2358):

```bash
oru server start
oru server start --port 3000
```

The server runs in the foreground. Press `Ctrl+C` to stop it. On startup, it prints a pairing code for authenticating clients.

## Authentication

The server uses bearer token authentication. Obtain a token via the pairing flow:

### 1. Get the pairing code

When the server starts, it prints a one-time pairing code to the terminal.

### 2. Exchange for a token

```bash
curl -X POST "http://localhost:2358/pair?code=ABCDEF"
```

Response:

```json
{ "token": "your-auth-token" }
```

The pairing code can only be used once. After pairing, use the token for all subsequent requests.

### 3. Use the token

Include the token in the `Authorization` header:

```bash
curl -H "Authorization: Bearer your-auth-token" http://localhost:2358/tasks
```

---

## Endpoints

### GET /tasks

List tasks. By default, hides tasks with status `done`.

| Parameter    | Type    | Description                           |
| ------------ | ------- | ------------------------------------- |
| `status`     | string  | Filter by status (comma-separated)    |
| `priority`   | string  | Filter by priority (comma-separated)  |
| `label`      | string  | Filter by label                       |
| `owner`      | string  | Filter by owner                       |
| `search`     | string  | Search by title                       |
| `actionable` | any     | If present, show only unblocked tasks |
| `all`        | any     | If present, include done tasks        |
| `limit`      | integer | Maximum results to return             |
| `offset`     | integer | Number of results to skip             |

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:2358/tasks?status=in_progress&priority=high"
```

Returns an array of task objects.

### GET /tasks/:id

Get a single task by ID or unique prefix.

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:2358/tasks/hJ7kMp3nQrs
```

Returns `404` if not found, `409` if the prefix is ambiguous.

### POST /tasks

Create a new task. Returns `201` on success.

```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Fix login bug","priority":"high","labels":["bug"]}' \
  http://localhost:2358/tasks
```

Request body:

| Field        | Type     | Required | Description                                  |
| ------------ | -------- | -------- | -------------------------------------------- |
| `title`      | string   | Yes      | Task title (1–1000 chars)                    |
| `id`         | string   | No       | Custom ID (for idempotent creates)           |
| `status`     | string   | No       | `todo`, `in_progress`, `in_review`, `done`   |
| `priority`   | string   | No       | `low`, `medium`, `high`, `urgent`            |
| `owner`      | string?  | No       | Owner name (null to unset)                   |
| `due_at`     | string?  | No       | ISO date: `YYYY-MM-DD` or `YYYY-MM-DDTHH:MM` |
| `blocked_by` | string[] | No       | Array of blocking task IDs                   |
| `labels`     | string[] | No       | Array of label strings                       |
| `notes`      | string[] | No       | Array of note strings                        |
| `recurrence` | string?  | No       | RRULE string (e.g. `FREQ=DAILY`)             |
| `metadata`   | object   | No       | Key-value metadata                           |

**Idempotent creates:** if you provide an `id` and a task with that ID already exists, the existing task is returned with a `200` status instead of creating a duplicate.

### PATCH /tasks/:id

Update a task. All fields are optional.

```bash
curl -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"done","note":"Completed in sprint 12"}' \
  http://localhost:2358/tasks/hJ7kMp3nQrs
```

Request body:

| Field         | Type     | Description                         |
| ------------- | -------- | ----------------------------------- |
| `title`       | string   | New title                           |
| `status`      | string   | New status                          |
| `priority`    | string   | New priority                        |
| `owner`       | string?  | New owner (null to clear)           |
| `due_at`      | string?  | New due date (null to clear)        |
| `blocked_by`  | string[] | Replace blocked_by list             |
| `labels`      | string[] | Replace labels                      |
| `note`        | string   | Append a note                       |
| `clear_notes` | boolean  | Clear all notes before adding       |
| `recurrence`  | string?  | New recurrence rule (null to clear) |
| `metadata`    | object   | Merge into existing metadata        |

### DELETE /tasks/:id

Delete a task.

```bash
curl -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:2358/tasks/hJ7kMp3nQrs
```

Returns `200` with `{ "id": "...", "deleted": true }` on success.

---

## Task object

```json
{
  "id": "hJ7kMp3nQrs",
  "title": "Fix login bug",
  "status": "in_progress",
  "priority": "high",
  "owner": "alice",
  "due_at": "2026-03-01T00:00:00.000Z",
  "blocked_by": [],
  "labels": ["bug", "frontend"],
  "notes": ["Reproduced on staging"],
  "recurrence": null,
  "metadata": { "pr": "142" },
  "created_at": "2026-02-20T10:00:00.000Z",
  "updated_at": "2026-02-20T12:30:00.000Z"
}
```

## Error responses

All errors return JSON with an `error` field:

```json
{ "error": "not_found", "id": "hJ7kMp3nQrs" }
```

| Status | Meaning                                 |
| ------ | --------------------------------------- |
| `400`  | Bad request (validation error)          |
| `401`  | Unauthorized (missing or invalid token) |
| `404`  | Task not found                          |
| `409`  | Conflict (ambiguous ID prefix)          |
| `500`  | Internal server error                   |
