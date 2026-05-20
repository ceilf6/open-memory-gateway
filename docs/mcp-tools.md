# MCP Tools

The MVP server uses stdio transport and exposes a small memory editing surface.

## capture_memory

Creates a `draft` memory.

Input:

```json
{
  "content": "Remember this preference.",
  "source": "manual",
  "tags": ["preference"]
}
```

## list_memories

Lists memories by optional status.

Input:

```json
{
  "status": "draft"
}
```

## search_memories

Searches indexed memory text by keyword.

Input:

```json
{
  "query": "preference",
  "status": "active"
}
```

## update_memory

Updates content, tags, source, scope, or status for one memory.

Input:

```json
{
  "id": "mem_20260520_abcd1234",
  "content": "Remember this updated preference.",
  "status": "active",
  "tags": ["preference"]
}
```

## approve_memory

Moves a memory to `active`.

Input:

```json
{
  "id": "mem_20260520_abcd1234"
}
```
