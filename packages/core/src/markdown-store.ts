import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { hashMemoryContent } from "./hash";
import { memoryBaseDir, memoryFilePath, statusDirName } from "./paths";
import { MemoryFrontmatterSchema, type MemoryRecord, type MemoryStatus } from "./schema";

export interface MarkdownMemoryStoreOptions {
  rootDir: string;
}

export class MarkdownMemoryStore {
  constructor(private readonly options: MarkdownMemoryStoreOptions) {}

  async write(record: MemoryRecord): Promise<MemoryRecord> {
    const parsedFrontmatter = MemoryFrontmatterSchema.parse(record.frontmatter);
    const filePath = memoryFilePath(
      this.options.rootDir,
      parsedFrontmatter.status,
      parsedFrontmatter.id,
    );
    await mkdir(path.dirname(filePath), { recursive: true });

    const previous = await this.findPath(parsedFrontmatter.id);
    if (previous && previous !== filePath) {
      await rm(previous, { force: true });
    }

    const content = record.content.trim();
    const file = matter.stringify(`${content}\n`, parsedFrontmatter);
    await writeFile(filePath, file, "utf8");

    return {
      frontmatter: parsedFrontmatter,
      content,
      path: filePath,
      contentHash: hashMemoryContent(record.content),
      possibleDuplicate: record.possibleDuplicate,
    };
  }

  async read(id: string): Promise<MemoryRecord> {
    const filePath = await this.findPath(id);
    if (!filePath) {
      throw new Error(`Memory not found: ${id}`);
    }

    const raw = await readFile(filePath, "utf8");
    const parsed = matter(raw);
    const frontmatter = MemoryFrontmatterSchema.parse(parsed.data);

    return {
      frontmatter,
      content: parsed.content.trim(),
      path: filePath,
      contentHash: hashMemoryContent(parsed.content),
    };
  }

  async list(status?: MemoryStatus): Promise<MemoryRecord[]> {
    const statuses: MemoryStatus[] = status ? [status] : ["draft", "active", "archived", "rejected"];
    const records: MemoryRecord[] = [];

    for (const currentStatus of statuses) {
      const dir = path.join(memoryBaseDir(this.options.rootDir), statusDirName(currentStatus));
      const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
        const id = entry.name.slice(0, -3);
        const record = await this.read(id);
        if (record.frontmatter.status === currentStatus) {
          records.push(record);
        }
      }
    }

    return records.sort((a, b) => b.frontmatter.updatedAt.localeCompare(a.frontmatter.updatedAt));
  }

  private async findPath(id: string): Promise<string | undefined> {
    const dirs = ["inbox", "active", "archived"];
    for (const dir of dirs) {
      const filePath = path.join(memoryBaseDir(this.options.rootDir), dir, `${id}.md`);
      try {
        await readFile(filePath, "utf8");
        return filePath;
      } catch {
        continue;
      }
    }
    return undefined;
  }
}
