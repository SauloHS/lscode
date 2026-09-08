import { invoke } from "@tauri-apps/api/core";
import * as webfs from "./webfs";

const hasBackend = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export type FsEntry = { name: string; path: string; isDir: boolean };
export type SearchMatch = { path: string; line: number; col: number; text: string; length: number };

export const listDir = (path: string): Promise<FsEntry[]> =>
  hasBackend ? invoke<FsEntry[]>("list_dir", { path }) : Promise.resolve(webfs.listDir(path));

export const readFile = (path: string): Promise<string> =>
  hasBackend ? invoke<string>("read_file", { path }) : Promise.resolve(webfs.readFile(path));

export const writeFile = (path: string, content: string): Promise<void> =>
  hasBackend
    ? invoke<void>("write_file", { path, content })
    : Promise.resolve(webfs.writeFile(path, content)).then(() => webfs.persistFile(path));

export const createFile = (path: string): Promise<void> =>
  hasBackend ? invoke<void>("create_file", { path }) : Promise.resolve(webfs.createFile(path));

export const createDir = (path: string): Promise<void> =>
  hasBackend ? invoke<void>("create_dir", { path }) : Promise.resolve(webfs.createDir(path));

export const renamePath = (oldPath: string, newPath: string): Promise<void> =>
  hasBackend ? invoke<void>("rename_path", { oldPath, newPath }) : Promise.resolve(webfs.renamePath(oldPath, newPath));

export const deletePath = (path: string): Promise<void> =>
  hasBackend ? invoke<void>("delete_path", { path }) : Promise.resolve(webfs.deletePath(path));

export const walkFiles = (root: string): Promise<string[]> =>
  hasBackend ? invoke<string[]>("walk_files", { root }) : Promise.resolve(webfs.walkFiles(root));

export const searchFiles = (root: string, query: string, caseSensitive: boolean): Promise<SearchMatch[]> =>
  hasBackend
    ? invoke<SearchMatch[]>("search_files", { root, query, caseSensitive })
    : Promise.resolve(webfs.searchFiles(root, query, caseSensitive));

export const createPty = (rows: number, cols: number, cwd: string | null) =>
  invoke<number>("create_pty", { rows, cols, cwd });
export const ptyWrite = (id: number, data: string) => invoke<void>("pty_write", { id, data });
export const ptyResize = (id: number, rows: number, cols: number) =>
  invoke<void>("pty_resize", { id, cols, rows });
export const ptyKill = (id: number) => invoke<void>("pty_kill", { id });

export const hasTauriBackend = hasBackend;
