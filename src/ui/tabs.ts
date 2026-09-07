import { icons } from "../icons";
import { state, subscribe, isDirty } from "../state";
import { activateTab, closeTab } from "./editor";
import { basename, el, $ } from "../util";

export function renderTabs(): void {
  const container = $("tabs");
  container.innerHTML = "";
  if (state.tabs.length === 0) {
    container.appendChild(el("div", "empty"));
    return;
  }
  for (const tab of state.tabs) {
    const node = el("div", "tab");
    if (tab.path === state.active) node.classList.add("active");
    if (isDirty(tab)) node.classList.add("dirty");
    node.title = tab.path;
    const icon = el("span");
    icon.innerHTML = icons.file;
    const iconEl = icon.firstElementChild as SVGElement | null;
    if (iconEl) {
      iconEl.classList.add("file-icon");
      iconEl.style.width = "16px";
      iconEl.style.height = "16px";
    }
    const label = el("span", "label", basename(tab.path));
    const close = el("span", "tab-close");
    close.innerHTML = icons.close;
    const dot = el("span", "dirty-dot");
    node.append(icon, label, dot, close);
    node.addEventListener("click", (e) => {
      if (close.contains(e.target as Node)) return;
      activateTab(tab.path);
    });
    node.addEventListener("mousedown", (e) => {
      if (e.button === 1) {
        e.preventDefault();
        void closeTab(tab.path);
      }
    });
    close.addEventListener("click", (e) => {
      e.stopPropagation();
      void closeTab(tab.path);
    });
    container.appendChild(node);
  }
}

export function initTabs(): void {
  subscribe(renderTabs);
}
