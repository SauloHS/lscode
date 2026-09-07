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
    const width = Math.min(Math.max(e.clientX - 48, 170), window.innerWidth - 300);
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
    const height = Math.min(Math.max(window.innerHeight - e.clientY - 22, 100), window.innerHeight - 200);
    document.documentElement.style.setProperty("--panel-height", height + "px");
  });
  window.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    document.body.style.cursor = "";
  });
}
