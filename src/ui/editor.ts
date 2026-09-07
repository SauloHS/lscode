import * as monaco from "monaco-editor";
import { readFile, writeFile } from "../api";
import { findTab, activeTab, isDirty, notify, setActive, state } from "../state";
import { settings } from "../settings";
import { basename, languageFor, relative, $, el } from "../util";

let editor: monaco.editor.IStandaloneCodeEditor;

export function initEditor(): void {
  const s = settings();
  editor = monaco.editor.create($("editor"), {
    theme: s.theme === "light" ? "vs" : "vs-dark",
    automaticLayout: true,
    fontSize: s.fontSize,
    fontLigatures: true,
    minimap: { enabled: true },
    tabSize: 2,
  });
  editor.onDidChangeCursorPosition(() => notify());
}

export function getEditor(): monaco.editor.IStandaloneCodeEditor {
  return editor;
}

export async function openFile(path: string): Promise<void> {
  if (findTab(path)) {
    activateTab(path);
    return;
  }
  let content: string;
  try {
    content = await readFile(path);
  } catch (e) {
    console.error(e);
    return;
  }
  const model = monaco.editor.getModel(monaco.Uri.file(path));
  const textModel = model ?? monaco.editor.createModel(content, languageFor(path), monaco.Uri.file(path));
  if (model) textModel.setValue(content);
  const tab = { path, model: textModel, viewState: null, savedVersionId: 0 };
  tab.savedVersionId = textModel.getAlternativeVersionId();
  state.tabs.push(tab);
  textModel.onDidChangeContent(() => notify());
  activateTab(path);
}

export function activateTab(path: string): void {
  const tab = findTab(path);
  if (!tab) return;
  if (state.active && state.active !== path) {
    const prev = findTab(state.active);
    if (prev) prev.viewState = editor.saveViewState();
  }
  setActive(path);
  editor.setModel(tab.model);
  if (tab.viewState) editor.restoreViewState(tab.viewState);
  editor.layout();
  editor.focus();
  notify();
}

export async function closeTab(path: string): Promise<void> {
  const tab = findTab(path);
  if (!tab) return;
  const idx = state.tabs.indexOf(tab);
  if (isDirty(tab)) {
    const { confirmDialog } = await import("../overlay");
    const sure = await confirmDialog(`Do you want to save the changes you made to ${basename(path)}?`, "Save");
    if (sure) await saveTab(tab);
  }
  state.tabs.splice(idx, 1);
  tab.model.dispose();
  if (state.active === path) {
    const next = state.tabs[Math.min(idx, state.tabs.length - 1)];
    if (next) activateTab(next.path);
    else {
      setActive(null);
      editor.setModel(null);
      notify();
    }
  } else {
    notify();
  }
}

export function closeTabImmediate(path: string): void {
  const tab = findTab(path);
  if (!tab) return;
  const idx = state.tabs.indexOf(tab);
  state.tabs.splice(idx, 1);
  tab.model.dispose();
  if (state.active === path) {
    const next = state.tabs[Math.min(idx, state.tabs.length - 1)];
    if (next) activateTab(next.path);
    else {
      setActive(null);
      editor.setModel(null);
      notify();
    }
  } else {
    notify();
  }
}

async function saveTab(tab: { path: string; model: monaco.editor.ITextModel; savedVersionId: number }): Promise<void> {
  try {
    await writeFile(tab.path, tab.model.getValue());
    tab.savedVersionId = tab.model.getAlternativeVersionId();
  } catch (e) {
    console.error(e);
  }
  notify();
}

export async function saveActive(): Promise<void> {
  const tab = activeTab();
  if (tab) await saveTab(tab);
}

export async function saveAll(): Promise<void> {
  for (const tab of state.tabs) {
    if (isDirty(tab)) await saveTab(tab);
  }
}

export function revealPosition(path: string, line: number, col: number): void {
  const tab = findTab(path) ?? null;
  if (!tab) return;
  activateTab(path);
  editor.revealPositionInCenter({ lineNumber: line, column: col });
  editor.setPosition({ lineNumber: line, column: col });
}

export function refreshTheme(): void {
  const s = settings();
  monaco.editor.setTheme(s.theme === "light" ? "vs" : "vs-dark");
}

export function refreshFont(): void {
  editor.updateOptions({ fontSize: settings().fontSize });
}

export function renderBreadcrumbs(): void {
  const bc = $("breadcrumbs");
  bc.innerHTML = "";
  const tab = activeTab();
  if (!tab || !state.root) return;
  const parts = relative(state.root, tab.path).split("/");
  parts.forEach((part: string, i: number) => {
    if (i > 0) bc.appendChild(el("span", undefined, "›"));
    bc.appendChild(el("span", undefined, part));
  });
}

export function cursorLabel(): string {
  const pos = editor.getPosition();
  return pos ? `Ln ${pos.lineNumber}, Col ${pos.column}` : "";
}

export function eolLabel(): string {
  const tab = activeTab();
  if (!tab) return "";
  return tab.model.getEOL() === "\n" ? "LF" : "CRLF";
}

export function languageLabel(): string {
  const tab = activeTab();
  if (!tab) return "";
  const lang = tab.model.getLanguageId();
  const map: Record<string, string> = {
    typescript: "TypeScript",
    javascript: "JavaScript",
    plaintext: "Plain Text",
    shell: "Shell Script",
    ini: "INI",
    xml: "XML",
  };
  return map[lang] ?? lang.charAt(0).toUpperCase() + lang.slice(1);
}
