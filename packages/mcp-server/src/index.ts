#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  MemoryService,
  MemoryStatusSchema,
  type CaptureMemoryInput,
  type IndexedMemoryRow,
  type MemoryRecord,
  type MemoryStatus,
  type UpdateMemoryInput,
} from "@open-memory-gateway/core";
import { z } from "zod";

export interface ToolHandlerOptions {
  rootDir: string;
}

export interface MemoryToolHandlers {
  capture_memory(input: CaptureMemoryInput): Promise<MemoryRecord>;
  list_memories(input?: { status?: MemoryStatus }): Promise<IndexedMemoryRow[]>;
  search_memories(input: { query: string; status?: MemoryStatus }): Promise<IndexedMemoryRow[]>;
  update_memory(input: UpdateMemoryInput & { id: string }): Promise<MemoryRecord>;
  approve_memory(input: { id: string }): Promise<MemoryRecord>;
  reject_memory(input: { id: string }): Promise<MemoryRecord>;
  archive_memory(input: { id: string }): Promise<MemoryRecord>;
  close(): void;
}

type SerializableToolResult = MemoryRecord | IndexedMemoryRow[];

const statusSchema = z.object({
  status: MemoryStatusSchema.optional(),
});

const captureMemorySchema = z.object({
  content: z.string().min(1),
  source: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
  scope: z.string().min(1).optional(),
});

const searchMemoriesSchema = statusSchema.extend({
  query: z.string().min(1),
});

const updateMemorySchema = statusSchema.extend({
  id: z.string().min(1),
  content: z.string().min(1).optional(),
  source: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
  scope: z.string().min(1).optional(),
});

const idOnlySchema = z.object({
  id: z.string().min(1),
});

export function createToolHandlers(options: ToolHandlerOptions): MemoryToolHandlers {
  const service = new MemoryService({ rootDir: options.rootDir });
  const handlers = {
    capture_memory(input: CaptureMemoryInput): Promise<MemoryRecord> {
      return service.capture(captureMemorySchema.parse(input));
    },
    list_memories(input: { status?: MemoryStatus } = {}): Promise<IndexedMemoryRow[]> {
      const parsed = statusSchema.parse(input);
      return service.list(parsed.status);
    },
    search_memories(input: { query: string; status?: MemoryStatus }): Promise<IndexedMemoryRow[]> {
      const parsed = searchMemoriesSchema.parse(input);
      return service.search(parsed.query, parsed.status);
    },
    update_memory(input: UpdateMemoryInput & { id: string }): Promise<MemoryRecord> {
      const { id, ...update } = updateMemorySchema.parse(input);
      return service.update(id, update);
    },
    approve_memory(input: { id: string }): Promise<MemoryRecord> {
      const parsed = idOnlySchema.parse(input);
      return service.approve(parsed.id);
    },
    reject_memory(input: { id: string }): Promise<MemoryRecord> {
      const parsed = idOnlySchema.parse(input);
      return service.reject(parsed.id);
    },
    archive_memory(input: { id: string }): Promise<MemoryRecord> {
      const parsed = idOnlySchema.parse(input);
      return service.archive(parsed.id);
    },
  } as MemoryToolHandlers;

  Object.defineProperty(handlers, "close", {
    value: () => service.close(),
    enumerable: false,
  });

  return handlers;
}

export function createServer(rootDir = process.env.OPEN_MEMORY_ROOT ?? process.cwd()): McpServer {
  const server = new McpServer({
    name: "open-memory-gateway",
    version: "0.1.0",
  });
  const handlers = createToolHandlers({ rootDir });

  server.registerTool(
    "capture_memory",
    {
      description: "Capture a selected or submitted text fragment as a draft long-term memory.",
      inputSchema: captureMemorySchema.shape,
    },
    async (input) => toMcpResult(await handlers.capture_memory(input)),
  );

  server.registerTool(
    "list_memories",
    {
      description: "List indexed memories, optionally filtered by status.",
      inputSchema: statusSchema.shape,
    },
    async (input) => toMcpResult(await handlers.list_memories(input)),
  );

  server.registerTool(
    "search_memories",
    {
      description: "Search indexed memories by text, optionally filtered by status.",
      inputSchema: searchMemoriesSchema.shape,
    },
    async (input) => toMcpResult(await handlers.search_memories(input)),
  );

  server.registerTool(
    "update_memory",
    {
      description: "Edit memory content, tags, scope, source, or status.",
      inputSchema: updateMemorySchema.shape,
    },
    async (input) => toMcpResult(await handlers.update_memory(input)),
  );

  server.registerTool(
    "approve_memory",
    {
      description: "Approve a draft memory and mark it active.",
      inputSchema: idOnlySchema.shape,
    },
    async (input) => toMcpResult(await handlers.approve_memory(input)),
  );

  server.registerTool(
    "reject_memory",
    {
      description: "Reject a draft memory and mark it rejected.",
      inputSchema: idOnlySchema.shape,
    },
    async (input) => toMcpResult(await handlers.reject_memory(input)),
  );

  server.registerTool(
    "archive_memory",
    {
      description: "Archive an active memory for long-term storage.",
      inputSchema: idOnlySchema.shape,
    },
    async (input) => toMcpResult(await handlers.archive_memory(input)),
  );

  return server;
}

export async function startServer(rootDir = process.env.OPEN_MEMORY_ROOT ?? process.cwd()): Promise<void> {
  const server = createServer(rootDir);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

function toMcpResult(value: SerializableToolResult) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await startServer();
}
