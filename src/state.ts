import * as monaco from "monaco-editor";

export type Tab = {
  path: string;
  model: monaco.editor.ITextModel;
  viewState: monaco.editor.ICodeEditorViewState | null;
  savedVersionId: number;
};

export type State = {
  root: string | null;
  tabs: Tab[];
  active: string | null;
  sidebarVisible: boolean;
  sidebarView: string;
  panelVisible: boolean;
};

export const state: State = {
  root: null,
  tabs: [],
  active: null,
  sidebarVisible: true,
  sidebarView: "explorer",
  panelVisible: false,
};

const listeners = new Set<() => void>();

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notify(): void {
  for (const fn of listeners) fn();
}

export function findTab(path: string): Tab | undefined {
  return state.tabs.find((t) => t.path === path);
}

export function activeTab(): Tab | undefined {
  return state.tabs.find((t) => t.path === state.active);
}

export function isDirty(tab: Tab): boolean {
  return tab.model.getAlternativeVersionId() !== tab.savedVersionId;
}

export function setRoot(root: string | null): void {
  state.root = root;
}

export function setActive(path: string | null): void {
  state.active = path;
}
