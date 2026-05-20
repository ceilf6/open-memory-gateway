# Open Memory Gateway

Open Memory Gateway is a local-first long-term memory gateway for agents.

It provides:

- Markdown files as the durable source of truth.
- A rebuildable SQLite index for search, status filtering, and duplicate hints.
- A CLI for local workflows.
- An MCP stdio server for agent integration.
- A small Next.js UI for inbox review and memory editing.

## Repository Shape

```text
apps/web
packages/core
packages/cli
packages/mcp-server
packages/adapters
docs
```

## MVP Storage Model

Each memory is one Markdown file with frontmatter metadata. SQLite is an index and can be rebuilt from Markdown at any time.
