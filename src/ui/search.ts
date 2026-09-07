import { searchFiles, type SearchMatch } from "../api";
import { icons } from "../icons";
import { openFile, revealPosition } from "./editor";
import { state } from "../state";
import { basename, el, relative, $ } from "../util";

let caseSensitive = false;
let matches: SearchMatch[] = [];
let searchRequestId = 0;

export function initSearch(): void {
  const body = $("sidebar-body");
  body.innerHTML = "";

  const controls = el("div", "search-controls");
  const wrap = el("div", "search-input-wrap");
  const input = el("input") as HTMLInputElement;
  input.placeholder = "Search";
  input.spellcheck = false;
  const caseBtn = el("button", "case-toggle", "Aa");
  caseBtn.title = "Match Case";
  wrap.append(input, caseBtn);
  controls.appendChild(wrap);
  body.appendChild(controls);

  const summary = el("div", "search-summary");
  body.appendChild(summary);

  const results = el("div", "search-results");
  body.appendChild(results);

  caseBtn.addEventListener("click", () => {
    caseSensitive = !caseSensitive;
    caseBtn.classList.toggle("on", caseSensitive);
    void run(input.value);
  });

  let timer: number | undefined;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => void run(input.value), 300);
  });

  body.dataset.view = "search";
}

async function run(query: string): Promise<void> {
  const requestId = ++searchRequestId;
  const results = document.querySelector("#sidebar-body .search-results") as HTMLElement | null;
  const summary = document.querySelector("#sidebar-body .search-summary") as HTMLElement | null;
  if (!results || !summary || !state.root || !query) {
    matches = [];
    if (results) results.innerHTML = "";
    if (summary) summary.textContent = "";
    return;
  }
  matches = await searchFiles(state.root, query, caseSensitive);
  if (requestId !== searchRequestId) return;
  summary.textContent = `${matches.length} results in ${new Set(matches.map((m) => m.path)).size} files`;
  results.innerHTML = "";
  renderMatches(results);
}

function renderMatches(results: HTMLElement): void {
  const byFile = new Map<string, SearchMatch[]>();
  for (const match of matches) {
    const list = byFile.get(match.path) ?? [];
    list.push(match);
    byFile.set(match.path, list);
  }
  for (const [path, list] of byFile) {
    const file = el("div", "search-file");
    const fileRow = el("div", "file-row");
    const icon = el("span");
    icon.innerHTML = icons.file;
    (icon.firstElementChild as SVGElement).classList.add("file-icon");
    fileRow.append(icon, el("span", undefined, state.root ? relative(state.root, path) : basename(path)));
    fileRow.append(el("span", "count", String(list.length)));
    fileRow.addEventListener("click", () => void openFile(path));
    file.appendChild(fileRow);
    for (const match of list) {
      const line = el("div", "search-line");
      const lnum = el("span", "lnum", String(match.line));
      const text = el("span", "ltext");
      const before = match.text.slice(0, match.col - 1);
      const hit = match.text.slice(match.col - 1, match.col - 1 + match.length);
      const after = match.text.slice(match.col - 1 + match.length);
      text.append(
        document.createTextNode(before),
        (() => {
          const mark = el("mark");
          mark.textContent = hit;
          return mark;
        })(),
        document.createTextNode(after),
      );
      line.append(lnum, text);
      line.addEventListener("click", () => revealPosition(path, match.line, match.col));
      file.appendChild(line);
    }
    results.appendChild(file);
  }
}
