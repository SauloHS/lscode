import { createDir, createFile, deletePath, listDir, renamePath, type FsEntry } from "../api";
import { icons } from "../icons";
import { closeTabImmediate, openFile } from "./editor";
import { showContextMenu } from "../overlay";
import { state, subscribe } from "../state";
import { basename, el, $, joinPath, dirname } from "../util";

const expanded = new Set<string>();

function item(entry: FsEntry): HTMLElement {
  const wrap = el("div", "tree-item");
  const node = el("div", "tree-row");
  if (entry.path === state.active) node.classList.add("active");
  if (entry.isDir && expanded.has(entry.path)) node.classList.add("expanded");

  const chevron = el("span", "chevron" + (entry.isDir ? "" : " placeholder"));
  if (entry.isDir) chevron.innerHTML = icons.chevron;
  const icon = el("span");
  icon.innerHTML = entry.isDir ? icons.folder : icons.file;
  (icon.firstElementChild as SVGElement).classList.add("file-icon");
  const label = el("span", undefined, entry.name);
  node.append(chevron, icon, label);
  node.title = entry.name;

  const kids = el("div", "tree-children");
  kids.style.paddingLeft = "16px";
  wrap.append(node, kids);

  node.addEventListener("click", () => {
    if (entry.isDir) void toggle(entry.path, node, kids);
    else void openFile(entry.path);
  });

  node.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    const dir = entry.isDir ? entry.path : dirname(entry.path);
    showContextMenu(e.clientX, e.clientY, [
      { label: "New File…", run: () => void newFile(dir) },
      { label: "New Folder…", run: () => void newFolder(dir) },
      "separator",
      { label: "Rename…", run: () => void rename(entry) },
      { label: "Delete", run: () => void remove(entry) },
    ]);
  });

  if (entry.isDir && expanded.has(entry.path)) {
    void fill(entry.path, kids);
  }

  return wrap;
}

async function fill(path: string, kids: HTMLElement): Promise<void> {
  kids.innerHTML = "";
  const entries = await listDir(path);
  for (const entry of entries) kids.appendChild(item(entry));
}

async function toggle(path: string, node: HTMLElement, kids: HTMLElement): Promise<void> {
  if (expanded.has(path)) {
    expanded.delete(path);
    node.classList.remove("expanded");
    kids.style.display = "none";
  } else {
    expanded.add(path);
    node.classList.add("expanded");
    kids.style.display = "";
    if (!kids.childElementCount) await fill(path, kids);
  }
}

async function refreshTree(): Promise<void> {
  const body = $("sidebar-body");
  body.innerHTML = "";
  if (!state.root) return;
  if (expanded.size === 0) expanded.add(state.root);
  const wrap = el("div", "tree-item");
  const node = el("div", "tree-row expanded");
  const chevron = el("span", "chevron");
  chevron.innerHTML = icons.chevron;
  const icon = el("span");
  icon.innerHTML = icons.folder;
  (icon.firstElementChild as SVGElement).classList.add("file-icon");
  const label = el("span", undefined, basename(state.root));
  node.append(chevron, icon, label);
  node.title = state.root;
  const kids = el("div", "tree-children");
  kids.style.paddingLeft = "16px";
  wrap.append(node, kids);
  const tree = el("div", "tree");
  tree.appendChild(wrap);
  body.appendChild(tree);
  await fill(state.root, kids);

  node.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY, [
      { label: "New File…", run: () => void newFile(state.root!) },
      { label: "New Folder…", run: () => void newFolder(state.root!) },
      "separator",
      { label: "Collapse All", run: () => {
        expanded.clear();
        expanded.add(state.root!);
        void refreshTree();
      } },
    ]);
  });
}

export async function newFile(dir: string): Promise<void> {
  const { promptDialog } = await import("../overlay");
  const name = await promptDialog("New File", "", "file name");
  if (!name) return;
  const path = joinPath(dir, name);
  await createFile(path);
  expanded.add(dir);
  await refreshTree();
  void openFile(path);
}

export async function newFolder(dir: string): Promise<void> {
  const { promptDialog } = await import("../overlay");
  const name = await promptDialog("New Folder", "", "folder name");
  if (!name) return;
  await createDir(joinPath(dir, name));
  expanded.add(dir);
  await refreshTree();
}

async function rename(entry: FsEntry): Promise<void> {
  const { promptDialog } = await import("../overlay");
  const name = await promptDialog("Rename", entry.name);
  if (!name || name === entry.name) return;
  await renamePath(entry.path, joinPath(dirname(entry.path), name));
  closeTabImmediate(entry.path);
  await refreshTree();
}

async function remove(entry: FsEntry): Promise<void> {
  const { confirmDialog } = await import("../overlay");
  const sure = await confirmDialog(`Are you sure you want to delete '${entry.name}'?`);
  if (!sure) return;
  await deletePath(entry.path);
  closeTabImmediate(entry.path);
  await refreshTree();
}

function markActive(): void {
  document.querySelectorAll("#sidebar-body .tree-row").forEach((node) => {
    const row = node as HTMLElement;
    row.classList.toggle("active", row.title === state.active);
  });
}

let subscribed = false;

export function initExplorer(): void {
  if (!subscribed) {
    subscribed = true;
    subscribe(markActive);
  }
  void refreshTree();
}

export function refreshExplorer(): Promise<void> {
  return refreshTree();
}
