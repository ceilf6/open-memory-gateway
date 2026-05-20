#!/usr/bin/env node
import { Command } from "commander";
import { MemoryService, MemoryStatusSchema } from "@open-memory-gateway/core";

const program = new Command();

function createService(): MemoryService {
  return new MemoryService({ rootDir: process.env.OPEN_MEMORY_ROOT ?? process.cwd() });
}

async function withService<T>(action: (service: MemoryService) => Promise<T>): Promise<T> {
  const service = createService();
  try {
    return await action(service);
  } finally {
    service.close();
  }
}

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

function collectTag(tag: string, tags: string[]): string[] {
  return [...tags, tag];
}

program.name("memory").description("Open Memory Gateway CLI").version("0.1.0");

program
  .command("capture")
  .argument("<content>")
  .option("-t, --tag <tag>", "Tag to attach", collectTag, [])
  .option("-s, --source <source>", "Memory source", "manual")
  .action(async (content: string, options: { tag: string[]; source: string }) => {
    const record = await withService((service) =>
      service.capture({ content, source: options.source, tags: options.tag }),
    );
    printJson(record);
  });

program
  .command("list")
  .option("--status <status>", "Filter by memory status")
  .action(async (options: { status?: string }) => {
    const status = options.status ? MemoryStatusSchema.parse(options.status) : undefined;
    const memories = await withService((service) => service.list(status));
    printJson(memories);
  });

program
  .command("approve")
  .argument("<id>")
  .action(async (id: string) => {
    const record = await withService((service) => service.approve(id));
    printJson(record);
  });

program
  .command("reject")
  .argument("<id>")
  .action(async (id: string) => {
    const record = await withService((service) => service.reject(id));
    printJson(record);
  });

program
  .command("archive")
  .argument("<id>")
  .action(async (id: string) => {
    const record = await withService((service) => service.archive(id));
    printJson(record);
  });

program
  .command("search")
  .argument("<query>")
  .option("--status <status>", "Filter by memory status")
  .action(async (query: string, options: { status?: string }) => {
    const status = options.status ? MemoryStatusSchema.parse(options.status) : undefined;
    const memories = await withService((service) => service.search(query, status));
    printJson(memories);
  });

program
  .command("index")
  .argument("<action>")
  .action(async (action: string) => {
    if (action !== "rebuild") {
      throw new Error(`Unsupported index action: ${action}`);
    }

    const indexed = await withService((service) => service.rebuildIndex());
    printJson({ indexed });
  });

try {
  await program.parseAsync(process.argv);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
}
