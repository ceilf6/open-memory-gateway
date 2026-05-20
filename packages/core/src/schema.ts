import { z } from "zod";

export const MemoryStatusSchema = z.enum(["draft", "active", "archived", "rejected"]);
export type MemoryStatus = z.infer<typeof MemoryStatusSchema>;

export const MemoryFrontmatterSchema = z.object({
  id: z.string().regex(/^mem_[0-9]{8}_[a-z0-9]+$/),
  status: MemoryStatusSchema,
  scope: z.string().min(1).default("personal"),
  source: z.string().min(1).default("manual"),
  tags: z.array(z.string()).default([]),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export type MemoryFrontmatter = z.infer<typeof MemoryFrontmatterSchema>;

export const MemoryRecordSchema = z.object({
  frontmatter: MemoryFrontmatterSchema,
  content: z.string().min(1),
  path: z.string().optional(),
  contentHash: z.string().optional(),
  possibleDuplicate: z.boolean().optional(),
});

export type MemoryRecord = z.infer<typeof MemoryRecordSchema>;

export interface CaptureMemoryInput {
  content: string;
  source?: string;
  tags?: string[];
  scope?: string;
}

export interface UpdateMemoryInput {
  content?: string;
  status?: MemoryStatus;
  source?: string;
  tags?: string[];
  scope?: string;
}

export function normalizeTags(tags: string[] = []): string[] {
  return [...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
}
