import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import { open } from "@tauri-apps/plugin-dialog";

import { hasTauriBackend, listDir } from "./api";
import { register } from "./commands";
import { initLayout } from "./layout";
import { applySettings, settings, updateSettings } from "./settings";
import { notify, setRoot, state, subscribe, isDirty } from "./state";
import { $, el, basename } from "./util";
import * as webfs from "./webfs";
import type { DirHandleLike } from "./webfs";
import { initEditor, getEditor, saveActive, saveAll, saveTab, closeTab, closeTabImmediate, refreshTheme, refreshFont, renderBreadcrumbs } from "./ui/editor";
import { initTabs } from "./ui/tabs";
import { initActivitybar, initSidebar, switchView } from "./ui/sidebar";
import { newFile, newFolder, refreshExplorer } from "./ui/explorer";
import { initStatusbar } from "./ui/statusbar";
import { initMenubar } from "./ui/menubar";
import { initTerminal, newTerminal, togglePanel, refreshTerminalTheme } from "./ui/terminal";
import { openPalette, buildFileIndex } from "./ui/palette";
import { confirmDialog, saveChangesDialog } from "./overlay";

const monacoEnvironment: monaco.Environment = {
  getWorker(_moduleId: string, label: string) {
    switch (label) {
      case "typescript":
      case "javascript":
        return new tsWorker();
      case "css":
      case "scss":
      case "less":
        return new cssWorker();
      case "html":
      case "handlebars":
      case "razor":
        return new htmlWorker();
      case "json":
        return new jsonWorker();
      default:
        return new editorWorker();
    }
  },
};

self.MonacoEnvironment = monacoEnvironment;

const WEB_MAX_FILE_BYTES = 1_000_000;

async function openFolder(): Promise<void> {
  if (!hasTauriBackend) {
    await openFolderWeb();
    return;
  }
  const dir = await open({ directory: true, multiple: false });
  if (typeof dir === "string" && dir.length > 0) await setWorkspace(dir);
}

async function openFolderWeb(): Promise<void> {
  const picker = (window as unknown as { showDirectoryPicker?: () => Promise<DirHandleLike> })
    .showDirectoryPicker;
  if (picker) {
    try {
      const dir = await picker.call(window);
      webfs.clear();
      await collectDir(dir, "");
      await setWorkspace(dir.name);
    } catch {
      // user cancelled or denied access
    }
    return;
  }
  const picked = await pickFolder();
  if (picked.length === 0) return;
  const root = picked[0].webkitRelativePath.split("/")[0];
  webfs.clear();
  for (const file of picked) {
    const parts = file.webkitRelativePath.split("/");
    if (parts.slice(1, -1).some((seg) => webfs.IGNORED_DIRS.includes(seg))) continue;
    if (file.size > WEB_MAX_FILE_BYTES) continue;
    webfs.addFile(file.webkitRelativePath, await file.text());
  }
  await setWorkspace(root);
}

async function collectDir(dir: DirHandleLike, prefix: string): Promise<void> {
  for await (const entry of dir.values()) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.kind === "directory") {
      if (webfs.IGNORED_DIRS.includes(entry.name)) continue;
      webfs.createDir(path);
      await collectDir(entry, path);
    } else {
      const file = await entry.getFile();
      if (file.size > WEB_MAX_FILE_BYTES) continue;
      webfs.addFile(path, await file.text(), entry);
    }
  }
}

function pickFolder(): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    (input as HTMLInputElement & { webkitdirectory: boolean }).webkitdirectory = true;
    input.addEventListener("change", () => resolve(input.files ? [...input.files] : []));
    input.click();
  });
}

async function closeAllTabs(): Promise<boolean> {
  for (const tab of [...state.tabs]) {
    if (isDirty(tab)) {
      const choice = await saveChangesDialog(`Do you want to save the changes you made to ${basename(tab.path)}?`);
      if (choice === "cancel") return false;
      if (choice === "save" && !(await saveTab(tab))) return false;
    }
    closeTabImmediate(tab.path);
  }
  return true;
}

async function setWorkspace(root: string): Promise<void> {
  if (!(await closeAllTabs())) return;
  setRoot(root);
  localStorage.setItem("lscode.root", root);
  switchView("explorer");
  await buildFileIndex();
  notify();
}

async function closeFolder(): Promise<void> {
  if (!(await closeAllTabs())) return;
  setRoot(null);
  localStorage.removeItem("lscode.root");
  if (!hasTauriBackend) webfs.clear();
  $("sidebar-body").innerHTML = "";
  notify();
}

async function restoreWorkspace(): Promise<void> {
  const root = localStorage.getItem("lscode.root");
  if (!root || !hasTauriBackend) return;
  try {
    await listDir(root);
    if (state.root !== null || localStorage.getItem("lscode.root") !== root) return;
    await setWorkspace(root);
  } catch {
    localStorage.removeItem("lscode.root");
  }
}

function toggleTheme(): void {
  const next = settings().theme === "dark" ? "light" : "dark";
  updateSettings({ theme: next });
  refreshTheme();
  refreshTerminalTheme();
}

function editorAction(id: string): void {
  const editor = getEditor();
  editor.focus();
  void editor.getAction(id)?.run();
}

function clipboardAction(kind: "Cut" | "Copy" | "Paste", fallback: string): void {
  const editor = getEditor();
  editor.focus();
  const action = editor.getAction(`editor.action.clipboard${kind}Action`);
  if (action) void action.run();
  else document.execCommand(fallback);
}

function registerCommands(): void {
  register({ id: "workbench.openFolder", label: "File: Open Folder", keybinding: "Ctrl+K Ctrl+O", run: openFolder });
  register({ id: "workbench.closeFolder", label: "File: Close Folder", run: closeFolder });
  register({ id: "file.save", label: "File: Save", keybinding: "Ctrl+S", run: saveActive });
  register({ id: "file.saveAll", label: "File: Save All", run: saveAll });
  register({ id: "file.closeTab", label: "File: Close Tab", keybinding: "Ctrl+W", run: () => { if (state.active) void closeTab(state.active); } });
  register({ id: "file.new", label: "File: New File", run: () => { if (state.root) void newFile(state.root); } });
  register({ id: "folder.new", label: "File: New Folder", run: () => { if (state.root) void newFolder(state.root); } });
  register({ id: "edit.undo", label: "Edit: Undo", run: () => editorAction("undo") });
  register({ id: "edit.redo", label: "Edit: Redo", run: () => editorAction("redo") });
  register({ id: "edit.cut", label: "Edit: Cut", run: () => clipboardAction("Cut", "cut") });
  register({ id: "edit.copy", label: "Edit: Copy", run: () => clipboardAction("Copy", "copy") });
  register({ id: "edit.paste", label: "Edit: Paste", run: () => clipboardAction("Paste", "paste") });
  register({ id: "edit.find", label: "Edit: Find", keybinding: "Ctrl+F", run: () => editorAction("actions.find") });
  register({ id: "edit.replace", label: "Edit: Replace", keybinding: "Ctrl+H", run: () => editorAction("editor.action.startFindReplaceAction") });
  register({ id: "workbench.showCommands", label: "View: Show Command Palette", keybinding: "Ctrl+Shift+P", run: () => openPalette("commands") });
  register({ id: "workbench.quickOpen", label: "Go to File", keybinding: "Ctrl+P", run: () => openPalette("files") });
  register({ id: "workbench.showExplorer", label: "View: Show Explorer", keybinding: "Ctrl+Shift+E", run: () => switchView("explorer") });
  register({ id: "workbench.showSearch", label: "View: Show Search", keybinding: "Ctrl+Shift+F", run: () => switchView("search") });
  register({ id: "workbench.toggleSidebar", label: "View: Toggle Sidebar", keybinding: "Ctrl+B", run: () => {
    state.sidebarVisible = !state.sidebarVisible;
    notify();
  } });
  register({ id: "workbench.increaseFont", label: "View: Increase Font Size", run: () => {
    updateSettings({ fontSize: Math.min(settings().fontSize + 1, 30) });
    refreshFont();
    refreshTerminalTheme();
  } });
  register({ id: "workbench.decreaseFont", label: "View: Decrease Font Size", run: () => {
    updateSettings({ fontSize: Math.max(settings().fontSize - 1, 8) });
    refreshFont();
    refreshTerminalTheme();
  } });
  register({ id: "help.about", label: "Help: About", run: () => void confirmDialog("LS Code 0.1.0 — Lightweight VS Code clone on Tauri", "OK") });
  register({ id: "workbench.refreshExplorer", label: "File: Refresh Explorer", run: () => void refreshExplorer() });
  register({ id: "workbench.toggleTheme", label: "Preferences: Toggle Theme", run: toggleTheme });
  if (hasTauriBackend) {
    register({ id: "workbench.togglePanel", label: "View: Toggle Terminal", keybinding: "Ctrl+`", run: () => togglePanel() });
    register({ id: "terminal.new", label: "Terminal: Create New Terminal", keybinding: "Ctrl+Shift+`", run: () => void newTerminal() });
  }
}

function initKeybindings(): void {
  window.addEventListener(
    "keydown",
    (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      if (e.code === "Backquote" && hasTauriBackend) {
        e.preventDefault();
        if (e.shiftKey) void newTerminal();
        else togglePanel();
        return;
      }
      const key = e.key.toLowerCase();
      const combos: Partial<Record<string, () => void>> = {
        p: e.shiftKey ? () => openPalette("commands") : () => openPalette("files"),
        s: saveActive,
        b: () => {
          state.sidebarVisible = !state.sidebarVisible;
          notify();
        },
        w: () => { if (state.active) void closeTab(state.active); },
        e: e.shiftKey ? () => switchView("explorer") : undefined,
        f: e.shiftKey ? () => switchView("search") : undefined,
      };
      const handler = combos[key];
      if (handler) {
        e.preventDefault();
        handler();
      }
    },
    { capture: true },
  );
}

function renderWelcome(): void {
  const welcome = $("welcome");
  const hasTabs = state.tabs.length > 0;
  welcome.classList.toggle("visible", !hasTabs);
  if (hasTabs) return;
  welcome.innerHTML = "";
  const title = el("h1", undefined, "LS Code");
  const hint = el("div", "hint", "Editing evolved, without the weight");
  const list = el("div");
  const shortcuts: [string, string][] = hasTauriBackend
    ? [
        ["Show All Commands", "Ctrl+Shift+P"],
        ["Go to File", "Ctrl+P"],
        ["Open Folder", "Ctrl+K Ctrl+O"],
        ["Toggle Terminal", "Ctrl+`"],
        ["Toggle Sidebar", "Ctrl+B"],
      ]
    : [
        ["Show All Commands", "Ctrl+Shift+P"],
        ["Go to File", "Ctrl+P"],
        ["Open Folder", "Ctrl+K Ctrl+O"],
        ["Toggle Sidebar", "Ctrl+B"],
      ];
  for (const [label, kbd] of shortcuts) {
    const row = el("div", "shortcut");
    row.append(el("kbd", undefined, kbd), document.createTextNode("  " + label));
    list.appendChild(row);
  }
  welcome.append(title, hint, list);
}

function init(): void {
  applySettings();
  initEditor();
  initMenubar();
  initActivitybar();
  initSidebar();
  initTabs();
  initStatusbar();
  initTerminal();
  initLayout();
  registerCommands();
  initKeybindings();
  togglePanel(false);

  subscribe(() => {
    renderWelcome();
    renderBreadcrumbs();
    document.title = state.active
      ? `${state.active.replace(/\\/g, "/").split("/").pop()} — LS Code`
      : "LS Code";
  });
  renderWelcome();

  void restoreWorkspace();
}

init();
