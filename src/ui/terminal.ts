import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { listen } from "@tauri-apps/api/event";
import { createPty, ptyKill, ptyResize, ptyWrite, hasTauriBackend } from "../api";
import { icons } from "../icons";
import { state } from "../state";
import { settings } from "../settings";
import { el, $ } from "../util";

type TermInstance = {
  id: number;
  term: Terminal;
  fit: FitAddon;
  element: HTMLElement;
  tabEl: HTMLElement;
};

const instances: TermInstance[] = [];
let active: number | null = null;
let outputDecoder: TextDecoder | null = null;

export function initTerminal(): void {
  if (!hasTauriBackend) return;
  const actions = $("panel-actions");
  actions.innerHTML = "";
  const newBtn = el("button");
  newBtn.title = "New Terminal";
  newBtn.innerHTML = icons.plus;
  newBtn.addEventListener("click", () => void newTerminal());
  const killBtn = el("button");
  killBtn.title = "Kill Active Terminal";
  killBtn.innerHTML = icons.trash;
  killBtn.addEventListener("click", () => killActive());
  actions.append(newBtn, killBtn);

  if (!hasTauriBackend) return;
  new ResizeObserver(() => refitAll()).observe($("panel-body"));
  void listen<{ id: number; data: string }>("pty-output", (event) => {
    const inst = instances.find((i) => i.id === event.payload.id);
    if (!inst) return;
    outputDecoder ??= new TextDecoder("utf-8", { fatal: false });
    const bytes = Uint8Array.from(atob(event.payload.data), (c) => c.charCodeAt(0));
    inst.term.write(outputDecoder.decode(bytes, { stream: true }));
  });
  void listen<{ id: number; code: number }>("pty-exit", (event) => {
    const inst = instances.find((i) => i.id === event.payload.id);
    if (!inst) return;
    inst.term.write(`\r\n\x1b[90mprocess exited (${event.payload.code})\x1b[0m\r\n`);
    inst.tabEl.classList.add("dead");
  });
}

export async function newTerminal(): Promise<void> {
  if (!hasTauriBackend) return;
  const panel = $("panel");
  if (panel.classList.contains("hidden")) togglePanel(true);

  const s = settings();
  const term = new Terminal({
    fontSize: s.fontSize,
    fontFamily: 'Consolas, "Courier New", monospace',
    theme: s.theme === "light" ? { background: "#ffffff" } : { background: "#1e1e1e" },
    cursorBlink: true,
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  const element = el("div", "terminal-instance");
  $("panel-body").appendChild(element);
  term.open(element);
  try {
    fit.fit();
  } catch {
    // container not measurable yet
  }

  let id: number;
  try {
    id = await createPty(term.rows, term.cols, state.root);
  } catch (error) {
    term.dispose();
    element.remove();
    console.error("Failed to create terminal", error);
    return;
  }
  const tabEl = el("div", "terminal-tab");
  const label = el("span", undefined, `pwsh ${id + 1}`);
  const close = el("span", "tab-close");
  close.innerHTML = icons.close;
  tabEl.append(label, close);
  $("panel-tabs").appendChild(tabEl);

  const inst: TermInstance = { id, term, fit, element, tabEl };
  instances.push(inst);

  tabEl.addEventListener("click", (e) => {
    if (close.contains(e.target as Node)) return;
    activate(id);
  });
  close.addEventListener("click", (e) => {
    e.stopPropagation();
    kill(id);
  });

  term.onData((data) => void ptyWrite(id, data));
  term.onResize(({ rows, cols }) => void ptyResize(id, rows, cols));

  activate(id);
  term.focus();
}

function activate(id: number): void {
  active = id;
  for (const inst of instances) {
    const isActive = inst.id === id;
    inst.element.classList.toggle("active", isActive);
    inst.tabEl.classList.toggle("active", isActive);
  }
}

function kill(id: number): void {
  const idx = instances.findIndex((i) => i.id === id);
  if (idx === -1) return;
  const inst = instances[idx];
  void ptyKill(id);
  inst.term.dispose();
  inst.element.remove();
  inst.tabEl.remove();
  instances.splice(idx, 1);
  if (active === id) {
    active = instances.length ? instances[instances.length - 1].id : null;
    if (active !== null) activate(active);
  }
  if (instances.length === 0) togglePanel(false);
}

function killActive(): void {
  if (active !== null) kill(active);
}

export function togglePanel(show?: boolean): void {
  const panel = $("panel");
  const resizer = $("panel-resizer");
  const visible = hasTauriBackend ? show ?? panel.classList.contains("hidden") : false;
  panel.classList.toggle("hidden", !visible);
  resizer.classList.toggle("hidden", !visible);
  state.panelVisible = visible;
  if (visible) {
    for (const inst of instances) {
      try {
        inst.fit.fit();
        void ptyResize(inst.id, inst.term.rows, inst.term.cols);
      } catch {
        // ignore fit errors on hidden containers
      }
    }
  }
}

export function refitAll(): void {
  for (const inst of instances) {
    try {
      inst.fit.fit();
      void ptyResize(inst.id, inst.term.rows, inst.term.cols);
    } catch {
      // ignore fit errors on hidden containers
    }
  }
}

export function refreshTerminalTheme(): void {
  const s = settings();
  for (const inst of instances) {
    inst.term.options.theme = s.theme === "light" ? { background: "#ffffff" } : { background: "#1e1e1e" };
    inst.term.options.fontSize = s.fontSize;
    try {
      inst.fit.fit();
      void ptyResize(inst.id, inst.term.rows, inst.term.cols);
    } catch {
      // ignore
    }
  }
}
