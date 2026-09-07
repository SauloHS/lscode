import { icons } from "../icons";
import { state, subscribe, notify } from "../state";
import { el, $ } from "../util";
import { refreshExplorer, initExplorer, newFile, newFolder } from "./explorer";
import { initSearch } from "./search";

const views: Record<string, { title: string; icon: string; init: () => void }> = {
  explorer: { title: "Explorer", icon: icons.files, init: initExplorer },
  search: { title: "Search", icon: icons.search, init: initSearch },
};

let currentView = "";

export function switchView(view: string): void {
  if (!views[view]) return;
  currentView = view;
  state.sidebarView = view;
  state.sidebarVisible = true;
  $("sidebar").classList.remove("hidden");
  $("sidebar-title").textContent = views[view].title;
  const actions = $("sidebar-actions");
  actions.innerHTML = "";
  $("sidebar-body").innerHTML = "";
  if (view === "explorer") renderExplorerActions(actions);
  views[view].init();
  notify();
}

function renderExplorerActions(actions: HTMLElement): void {
  const root = state.root;
  if (!root) return;
  const newFileBtn = iconBtn(icons.newFile, "New File", () => void newFile(root));
  const newFolderBtn = iconBtn(icons.newFolder, "New Folder", () => void newFolder(root));
  const refreshBtn = iconBtn(icons.refresh, "Refresh Explorer", () => void refreshExplorer());
  actions.append(newFileBtn, newFolderBtn, refreshBtn);
}

function iconBtn(svg: string, title: string, onClick: () => void): HTMLElement {
  const btn = el("button");
  btn.title = title;
  btn.innerHTML = svg;
  btn.addEventListener("click", onClick);
  return btn;
}

export function initSidebar(): void {
  subscribe(() => {
    $("sidebar").classList.toggle("hidden", !state.sidebarVisible);
    document.querySelectorAll(".activity-item").forEach((node) => {
      const id = (node as HTMLElement).dataset.view;
      (node as HTMLElement).classList.toggle(
        "active",
        id === currentView && state.sidebarVisible,
      );
    });
  });
}

export function initActivitybar(): void {
  const bar = $("activitybar");
  for (const [id, view] of Object.entries(views)) {
    const item = el("div", "activity-item");
    item.dataset.view = id;
    item.title = view.title;
    item.innerHTML = view.icon;
    item.addEventListener("click", () => {
      if (currentView === id && state.sidebarVisible) {
        state.sidebarVisible = false;
        notify();
      } else {
        switchView(id);
      }
    });
    bar.appendChild(item);
  }
}
