import { basename } from "./util";
import type { FsEntry, SearchMatch } from "./api";

const MAX_MATCHES = 2000;

export type WritableStreamLike = {
  write(data: string): Promise<void>;
  close(): Promise<void>;
};

export type FileHandleLike = {
  kind: "file";
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<WritableStreamLike>;
};

export type DirHandleLike = {
  kind: "directory";
  name: string;
  values(): AsyncIterableIterator<FileHandleLike | DirHandleLike>;
};

export const IGNORED_DIRS = [".git", "node_modules", "target", "dist", ".next", "__pycache__"];

type FileRecord = { content: string; handle: FileHandleLike | null };

const records = new Map<string, FileRecord>();
const dirs = new Set<string>();

function norm(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "");
}

export function clear(): void {
  records.clear();
  dirs.clear();
}

export function addFile(path: string, content: string, handle: FileHandleLike | null = null): void {
  records.set(norm(path), { content, handle });
}

export function readFile(path: string): string {
  const rec = records.get(norm(path));
  if (!rec) throw new Error(`File not found: ${path}`);
  return rec.content;
}

export function writeFile(path: string, content: string): void {
  const key = norm(path);
  const rec = records.get(key);
  if (rec) rec.content = content;
  else records.set(key, { content, handle: null });
}

export async function persistFile(path: string): Promise<void> {
  const rec = records.get(norm(path));
  if (!rec) throw new Error(`File not found: ${path}`);
  if (rec.handle) {
    const writable = await rec.handle.createWritable();
    await writable.write(rec.content);
    await writable.close();
    return;
  }
  const blob = new Blob([rec.content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = basename(path);
  a.click();
  URL.revokeObjectURL(url);
}

export function createFile(path: string): void {
  const key = norm(path);
  if (!records.has(key)) records.set(key, { content: "", handle: null });
}

export function createDir(path: string): void {
  dirs.add(norm(path));
}

export function renamePath(oldPath: string, newPath: string): void {
  const from = norm(oldPath);
  const to = norm(newPath);
  const rec = records.get(from);
  if (rec) {
    records.delete(from);
    records.set(to, rec);
    return;
  }
  for (const [path, content] of [...records]) {
    if (path.startsWith(from + "/")) {
      records.delete(path);
      records.set(to + path.slice(from.length), content);
    }
  }
  for (const dir of [...dirs]) {
    if (dir === from || dir.startsWith(from + "/")) {
      dirs.delete(dir);
      dirs.add(to + dir.slice(from.length));
    }
  }
}

export function deletePath(path: string): void {
  const base = norm(path);
  records.delete(base);
  for (const p of [...records.keys()]) {
    if (p.startsWith(base + "/")) records.delete(p);
  }
  dirs.delete(base);
  for (const d of [...dirs]) {
    if (d.startsWith(base + "/")) dirs.delete(d);
  }
}

export function listDir(path: string): FsEntry[] {
  const base = norm(path);
  const prefix = base + "/";
  const entries = new Map<string, FsEntry>();
  for (const p of records.keys()) {
    if (!p.startsWith(prefix)) continue;
    const rest = p.slice(prefix.length);
    const slash = rest.indexOf("/");
    if (slash === -1) entries.set(rest, { name: rest, path: p, isDir: false });
    else {
      const name = rest.slice(0, slash);
      if (!entries.has(name)) entries.set(name, { name, path: prefix + name, isDir: true });
    }
  }
  for (const d of dirs) {
    if (!d.startsWith(prefix)) continue;
    const rest = d.slice(prefix.length);
    if (rest === "" || rest.includes("/")) continue;
    if (!entries.has(rest)) entries.set(rest, { name: rest, path: d, isDir: true });
  }
  return [...entries.values()];
}

export function walkFiles(root: string): string[] {
  const prefix = norm(root) + "/";
  return [...records.keys()].filter((p) => p.startsWith(prefix));
}

export function searchFiles(root: string, query: string, caseSensitive: boolean): SearchMatch[] {
  const out: SearchMatch[] = [];
  const needle = caseSensitive ? query : query.toLowerCase();
  for (const p of walkFiles(root)) {
    const lines = (records.get(p)?.content ?? "").split("\n");
    for (let i = 0; i < lines.length; i++) {
      const hay = caseSensitive ? lines[i] : lines[i].toLowerCase();
      let col = hay.indexOf(needle);
      while (col !== -1) {
        out.push({ path: p, line: i + 1, col: col + 1, text: lines[i], length: query.length });
        if (out.length >= MAX_MATCHES) return out;
        col = hay.indexOf(needle, col + needle.length);
      }
    }
  }
  return out;
}
