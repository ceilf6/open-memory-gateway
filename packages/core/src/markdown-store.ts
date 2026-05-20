import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { hashMemoryContent } from "./hash";
import { memoryBaseDir, memoryFilePath, statusDirName } from "./paths";
import { MemoryFrontmatterSchema, type MemoryRecord, type MemoryStatus } from "./schema";

const MEMORY_ID_PATTERN = /^mem_[0-9]{8}_[a-z0-9]+$/;

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

    const content = record.content.trim();
    const file = matter.stringify(`${content}\n`, parsedFrontmatter);
    const previous = await this.findPath(parsedFrontmatter.id);
    await this.writeFileAtomically(filePath, file);

    if (previous && previous !== filePath) {
      await rm(previous, { force: true });
    }

    return {
      frontmatter: parsedFrontmatter,
      content,
      path: filePath,
      contentHash: hashMemoryContent(record.content),
      possibleDuplicate: record.possibleDuplicate,
    };
  }

  async read(id: string): Promise<MemoryRecord> {
    this.validateId(id);
    const filePath = await this.findPath(id);
    if (!filePath) {
      throw new Error(`Memory not found: ${id}`);
    }

    return this.readFilePath(filePath);
  }

  private async readFilePath(filePath: string): Promise<MemoryRecord> {
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
        const record = await this.readFilePath(path.join(dir, entry.name));
        if (record.frontmatter.status === currentStatus) {
          records.push(record);
        }
      }
    }

    return records.sort((a, b) => b.frontmatter.updatedAt.localeCompare(a.frontmatter.updatedAt));
  }

  private async findPath(id: string): Promise<string | undefined> {
    this.validateId(id);
    const dirs = ["inbox", "active", "archived"];
    for (const dir of dirs) {
      const filePath = path.join(memoryBaseDir(this.options.rootDir), dir, `${id}.md`);
      try {
        await readFile(filePath, "utf8");
        return filePath;
      } catch (error) {
        if (!isNotFoundError(error)) {
          throw error;
        }
        continue;
      }
    }
    return undefined;
  }

  private async writeFileAtomically(filePath: string, file: string): Promise<void> {
    const dir = path.dirname(filePath);
    const tempPath = path.join(dir, `.${path.basename(filePath)}.${randomUUID()}.tmp`);

    try {
      await writeFile(tempPath, file, "utf8");
      await rename(tempPath, filePath);
    } catch (error) {
      await rm(tempPath, { force: true });
      throw error;
    }
  }

  private validateId(id: string): void {
    if (!MEMORY_ID_PATTERN.test(id)) {
      throw new Error(`Invalid memory id: ${id}`);
    }
  }
}

function isNotFoundError(error: unknown): error is { code: "ENOENT" } {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
