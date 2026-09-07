import { walkFiles } from "../api";
import { openFile } from "./editor";
import { state } from "../state";
import { basename, el, fuzzyMatch, relative } from "../util";
import { getCommands } from "../commands";

export type PaletteMode = "files" | "commands";

type PaletteState = {
  overlay: HTMLElement;
  input: HTMLInputElement;
  list: HTMLElement;
  mode: PaletteMode;
  entries: { label: string; sub: string; run: () => void }[];
  selected: number;
};

let palette: PaletteState | null = null;
let fileIndex: { path: string; name: string; rel: string }[] = [];

export function buildFileIndex(): Promise<void> {
  const root = state.root;
  if (!root) {
    fileIndex = [];
    return Promise.resolve();
  }
  return walkFiles(root).then((files) => {
    if (state.root !== root) return;
    fileIndex = files.map((path) => ({
      path,
      name: basename(path),
      rel: relative(root, path),
    }));
  });
}

export function openPalette(mode: PaletteMode = "files"): void {
  closePalette();
  if (mode === "files" && !state.root) mode = "commands";

  const overlay = el("div", "overlay");
  const box = el("div", "palette");
  const input = el("input") as HTMLInputElement;
  input.placeholder = mode === "commands" ? "Type a command name" : "Search files by name";
  input.spellcheck = false;
  const list = el("div", "palette-list");
  box.append(input, list);
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  palette = { overlay, input, list, mode, entries: [], selected: 0 };
  input.value = mode === "commands" ? ">" : "";
  input.addEventListener("input", () => update());
  input.addEventListener("keydown", onKeyDown);
  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) closePalette();
  });
  update();
  input.focus();
}

function closePalette(): void {
  palette?.overlay.remove();
  palette = null;
}

function onKeyDown(e: KeyboardEvent): void {
  if (!palette) return;
  if (e.key === "Escape") {
    closePalette();
  } else if (e.key === "ArrowDown") {
    e.preventDefault();
    palette.selected = Math.min(palette.selected + 1, palette.entries.length - 1);
    renderList();
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    palette.selected = Math.max(palette.selected - 1, 0);
    renderList();
  } else if (e.key === "Enter") {
    e.preventDefault();
    const entry = palette.entries[palette.selected];
    closePalette();
    entry?.run();
  }
}

function update(): void {
  if (!palette) return;
  const raw = palette.input.value;
  const isCommandMode = raw.startsWith(">");
  const query = (isCommandMode ? raw.slice(1) : raw).trim();
  palette.mode = isCommandMode ? "commands" : "files";
  palette.selected = 0;

  if (isCommandMode) {
    palette.entries = getCommands()
      .map((cmd) => ({ cmd, match: fuzzyMatch(query, cmd.label) }))
      .filter((x) => x.match)
      .sort((a, b) => b.match!.score - a.match!.score)
      .slice(0, 50)
      .map(({ cmd }) => ({ label: cmd.label, sub: cmd.keybinding ?? "", run: () => cmd.run() }));
  } else if (state.root) {
    palette.entries = fileIndex
      .map((file) => ({ file, match: fuzzyMatch(query, file.rel) }))
      .filter((x) => x.match)
      .sort((a, b) => b.match!.score - a.match!.score)
      .slice(0, 50)
      .map(({ file }) => ({
        label: file.name,
        sub: file.rel,
        run: () => void openFile(file.path),
      }));
  } else {
    palette.entries = [];
  }
  renderList();
}

function renderList(): void {
  if (!palette) return;
  const { list, entries, selected } = palette;
  list.innerHTML = "";
  entries.forEach((entry, i) => {
    const item = el("div", "palette-item" + (i === selected ? " selected" : ""));
    item.appendChild(el("span", undefined, entry.label));
    if (entry.sub) item.appendChild(el("span", "sub", entry.sub));
    item.addEventListener("click", () => {
      closePalette();
      entry.run();
    });
    list.appendChild(item);
  });
  list.querySelector(".selected")?.scrollIntoView({ block: "nearest" });
}
