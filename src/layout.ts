import { $ } from "./util";

export function initLayout(): void {
  initSidebarResizer();
  initPanelResizer();
}

function initSidebarResizer(): void {
  const handle = $("sidebar-resizer");
  let dragging = false;
  handle.addEventListener("mousedown", () => {
    dragging = true;
    document.body.style.cursor = "col-resize";
  });
  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const maxWidth = Math.max(0, window.innerWidth - 300);
    const width = Math.min(Math.max(e.clientX - 48, Math.min(170, maxWidth)), maxWidth);
    document.documentElement.style.setProperty("--sidebar-width", width + "px");
  });
  window.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    document.body.style.cursor = "";
  });
}

function initPanelResizer(): void {
  const handle = $("panel-resizer");
  let dragging = false;
  handle.addEventListener("mousedown", () => {
    dragging = true;
    document.body.style.cursor = "row-resize";
  });
  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const maxHeight = Math.max(0, window.innerHeight - 200);
    const height = Math.min(Math.max(window.innerHeight - e.clientY - 22, Math.min(100, maxHeight)), maxHeight);
    document.documentElement.style.setProperty("--panel-height", height + "px");
  });
  window.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    document.body.style.cursor = "";
  });
}
