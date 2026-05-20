"use client";

import {
  Archive,
  Check,
  CircleDot,
  ClipboardPlus,
  Edit3,
  FileSearch,
  Inbox,
  RefreshCcw,
  Save,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { IndexedMemoryRow, MemoryRecord, MemoryStatus } from "@open-memory-gateway/core";

type ApiResult<T> = {
  data?: T;
  error?: string;
};

const statuses: Array<MemoryStatus | "all"> = ["all", "draft", "active", "archived", "rejected"];

export default function MemoryWorkspace() {
  const [content, setContent] = useState("");
  const [source, setSource] = useState("manual");
  const [tags, setTags] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<MemoryStatus | "all">("draft");
  const [memories, setMemories] = useState<IndexedMemoryRow[]>([]);
  const [selected, setSelected] = useState<IndexedMemoryRow | null>(null);
  const [editorContent, setEditorContent] = useState("");
  const [editorTags, setEditorTags] = useState("");
  const [editorStatus, setEditorStatus] = useState<MemoryStatus>("draft");
  const [isBusy, setIsBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    void refreshMemories();
  }, [query, status]);

  useEffect(() => {
    if (!selected) {
      setEditorContent("");
      setEditorTags("");
      setEditorStatus("draft");
      return;
    }

    setEditorContent(selected.searchText.split("\n")[0] ?? "");
    setEditorTags(selected.tags.join(", "));
    setEditorStatus(selected.status);
  }, [selected]);

  const selectedId = selected?.id;
  const activeCount = useMemo(() => memories.filter((memory) => memory.status === "active").length, [memories]);
  const duplicateCount = useMemo(() => memories.filter((memory) => memory.possibleDuplicate).length, [memories]);

  async function refreshMemories() {
    const params = new URLSearchParams();
    if (query.trim()) {
      params.set("q", query.trim());
    }
    if (status !== "all") {
      params.set("status", status);
    }

    const response = await fetch(`/api/memories?${params.toString()}`, { cache: "no-store" });
    const payload = (await response.json()) as ApiResult<IndexedMemoryRow[]>;
    if (!response.ok || !payload.data) {
      setNotice(payload.error ?? "Unable to load memories.");
      return;
    }

    setMemories(payload.data);
    if (selectedId) {
      setSelected(payload.data.find((memory) => memory.id === selectedId) ?? payload.data[0] ?? null);
    } else {
      setSelected(payload.data[0] ?? null);
    }
  }

  async function captureMemory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runBusy(async () => {
      const response = await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          source,
          tags: parseTags(tags),
        }),
      });
      const payload = (await response.json()) as ApiResult<MemoryRecord>;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? "Unable to capture memory.");
      }

      setContent("");
      setNotice("Captured as draft.");
      await refreshMemories();
    });
  }

  async function saveSelected(nextStatus = editorStatus) {
    if (!selected) {
      return;
    }

    await runBusy(async () => {
      const response = await fetch(`/api/memories/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: editorContent,
          status: nextStatus,
          tags: parseTags(editorTags),
        }),
      });
      const payload = (await response.json()) as ApiResult<MemoryRecord>;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? "Unable to update memory.");
      }

      setNotice("Memory updated.");
      await refreshMemories();
    });
  }

  async function approveSelected() {
    if (!selected) {
      return;
    }

    await runBusy(async () => {
      const response = await fetch(`/api/memories/${selected.id}/approve`, { method: "POST" });
      const payload = (await response.json()) as ApiResult<MemoryRecord>;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? "Unable to approve memory.");
      }

      setEditorStatus("active");
      setNotice("Memory approved.");
      await refreshMemories();
    });
  }

  async function runBusy(action: () => Promise<void>) {
    setIsBusy(true);
    setNotice("");
    try {
      await action();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Agent memory workbench</p>
          <h1>Open Memory Gateway</h1>
        </div>
        <div className="status-strip" aria-label="Memory summary">
          <span>
            <ShieldCheck size={16} aria-hidden="true" />
            {activeCount} active
          </span>
          <span>
            <CircleDot size={16} aria-hidden="true" />
            {memories.length} shown
          </span>
          <span>
            <FileSearch size={16} aria-hidden="true" />
            {duplicateCount} duplicates
          </span>
        </div>
      </header>

      <section className="workspace" aria-label="Memory editing workspace">
        <form className="capture-panel" onSubmit={captureMemory}>
          <div className="panel-title">
            <ClipboardPlus size={19} aria-hidden="true" />
            <span>Quick capture</span>
          </div>
          <textarea
            aria-label="Memory content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Paste selected text or write a memory."
            rows={8}
          />
          <div className="field-row">
            <label>
              Source
              <input value={source} onChange={(event) => setSource(event.target.value)} />
            </label>
            <label>
              Tags
              <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="feishu, agent" />
            </label>
          </div>
          <button className="primary-button" type="submit" disabled={isBusy || !content.trim()}>
            <ClipboardPlus size={17} aria-hidden="true" />
            Capture
          </button>
          {notice ? <p className="notice">{notice}</p> : null}
        </form>

        <section className="list-panel" aria-label="Memory list">
          <div className="toolbar">
            <label className="search-box">
              <Search size={17} aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search memories"
                aria-label="Search memories"
              />
            </label>
            <button className="icon-button" type="button" onClick={() => void refreshMemories()} aria-label="Refresh">
              <RefreshCcw size={17} aria-hidden="true" />
            </button>
          </div>
          <div className="tabs" aria-label="Status filter">
            {statuses.map((item) => (
              <button
                key={item}
                type="button"
                className={item === status ? "active" : ""}
                onClick={() => setStatus(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="memory-list">
            {memories.length ? (
              memories.map((memory) => (
                <button
                  key={memory.id}
                  type="button"
                  className={memory.id === selected?.id ? "memory-row selected" : "memory-row"}
                  onClick={() => setSelected(memory)}
                >
                  <span className={`pill ${memory.status}`}>{memory.status}</span>
                  <strong>{memory.searchText.split("\n")[0]}</strong>
                  <small>{memory.tags.length ? memory.tags.join(" / ") : memory.source}</small>
                </button>
              ))
            ) : (
              <div className="empty-state">
                <Inbox size={24} aria-hidden="true" />
                <span>No memories match this view.</span>
              </div>
            )}
          </div>
        </section>

        <section className="editor-panel" aria-label="Memory editor">
          <div className="panel-title">
            <Edit3 size={19} aria-hidden="true" />
            <span>Review editor</span>
          </div>
          {selected ? (
            <>
              <div className="meta-grid">
                <span>ID</span>
                <strong>{selected.id}</strong>
                <span>Source</span>
                <strong>{selected.source}</strong>
              </div>
              <textarea
                aria-label="Selected memory content"
                value={editorContent}
                onChange={(event) => setEditorContent(event.target.value)}
                rows={10}
              />
              <div className="field-row">
                <label>
                  Status
                  <select value={editorStatus} onChange={(event) => setEditorStatus(event.target.value as MemoryStatus)}>
                    <option value="draft">draft</option>
                    <option value="active">active</option>
                    <option value="archived">archived</option>
                    <option value="rejected">rejected</option>
                  </select>
                </label>
                <label>
                  Tags
                  <input value={editorTags} onChange={(event) => setEditorTags(event.target.value)} />
                </label>
              </div>
              <div className="action-row">
                <button className="primary-button" type="button" onClick={() => void approveSelected()} disabled={isBusy}>
                  <Check size={17} aria-hidden="true" />
                  Approve
                </button>
                <button className="secondary-button" type="button" onClick={() => void saveSelected()} disabled={isBusy}>
                  <Save size={17} aria-hidden="true" />
                  Save
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => void saveSelected("archived")}
                  disabled={isBusy}
                >
                  <Archive size={17} aria-hidden="true" />
                  Archive
                </button>
                <button
                  className="danger-button"
                  type="button"
                  onClick={() => void saveSelected("rejected")}
                  disabled={isBusy}
                >
                  <X size={17} aria-hidden="true" />
                  Reject
                </button>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <Inbox size={24} aria-hidden="true" />
              <span>Select a memory to edit.</span>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function parseTags(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}
