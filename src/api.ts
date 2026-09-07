import { invoke } from "@tauri-apps/api/core";

const hasBackend = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export type FsEntry = { name: string; path: string; isDir: boolean };
export type SearchMatch = { path: string; line: number; col: number; text: string; length: number };

async function call<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  if (!hasBackend) return [] as unknown as T;
  return invoke<T>(cmd, args);
}

export const listDir = (path: string) => call<FsEntry[]>("list_dir", { path });
export const readFile = (path: string) => call<string>("read_file", { path });
export const writeFile = (path: string, content: string) =>
  invoke<void>("write_file", { path, content }).then(() => undefined);
export const createFile = (path: string) => invoke<void>("create_file", { path }).then(() => undefined);
export const createDir = (path: string) => invoke<void>("create_dir", { path }).then(() => undefined);
export const renamePath = (oldPath: string, newPath: string) =>
  invoke<void>("rename_path", { oldPath, newPath }).then(() => undefined);
export const deletePath = (path: string) => invoke<void>("delete_path", { path }).then(() => undefined);
export const walkFiles = (root: string) => call<string[]>("walk_files", { root });
export const searchFiles = (root: string, query: string, caseSensitive: boolean) =>
  call<SearchMatch[]>("search_files", { root, query, caseSensitive });

export const createPty = (rows: number, cols: number, cwd: string | null) =>
  invoke<number>("create_pty", { rows, cols, cwd });
export const ptyWrite = (id: number, data: string) => invoke<void>("pty_write", { id, data });
export const ptyResize = (id: number, rows: number, cols: number) =>
  invoke<void>("pty_resize", { id, rows, cols });
export const ptyKill = (id: number) => invoke<void>("pty_kill", { id });

export const hasTauriBackend = hasBackend;
