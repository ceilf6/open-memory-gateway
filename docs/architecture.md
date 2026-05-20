# Architecture

Open Memory Gateway is local-first. Its durable state lives in Markdown, and every entry point calls the same core service.

## Source Of Truth

Markdown files under `memory/` are the durable source of truth. Each memory is one `.md` file with frontmatter metadata and body content.

## Rebuildable Index

SQLite under `memory/.index/memory.sqlite` stores query data only. It can be rebuilt from Markdown by running:

```bash
memory index rebuild
```

## Entry Points

- CLI invokes `MemoryService`.
- MCP stdio server invokes `MemoryService`.
- Next.js route handlers invoke `MemoryService` for the Web UI.
- Adapters transform external events into `CaptureMemoryInput`.

## Status Flow

New captures enter `draft`. A user or trusted workflow can then move them to `active`, `archived`, or `rejected`.

## Storage Contract

The Markdown files are intended to be human-readable and versionable. The SQLite index is a cache for search, status filtering, and duplicate hints.
