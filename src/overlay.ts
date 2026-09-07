import { el } from "./util";

export type MenuItem = { label: string; run: () => void } | "separator";

function closeOnOutside(menu: HTMLElement, onDone: () => void): void {
  setTimeout(() => {
    const closer = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node)) {
        menu.remove();
        document.removeEventListener("mousedown", closer);
        onDone();
      }
    };
    document.addEventListener("mousedown", closer);
  }, 0);
}

export function showContextMenu(x: number, y: number, items: MenuItem[]): void {
  document.querySelectorAll(".context-menu").forEach((m) => m.remove());
  const menu = el("div", "context-menu");
  for (const item of items) {
    if (item === "separator") {
      const sep = el("div");
      sep.style.cssText = "height:1px;background:var(--border);margin:4px 0";
      menu.appendChild(sep);
      continue;
    }
    const row = el("div", "menu-item", item.label);
    row.addEventListener("click", () => {
      menu.remove();
      item.run();
    });
    menu.appendChild(row);
  }
  document.body.appendChild(menu);
  const rect = menu.getBoundingClientRect();
  menu.style.left = Math.min(x, window.innerWidth - rect.width - 4) + "px";
  menu.style.top = Math.min(y, window.innerHeight - rect.height - 4) + "px";
  closeOnOutside(menu, () => {});
}

export function promptDialog(title: string, value = "", placeholder = ""): Promise<string | null> {
  return new Promise((resolve) => {
    const backdrop = el("div", "dialog-backdrop");
    const dialog = el("div", "dialog");
    const heading = el("h3", undefined, title);
    const input = el("input") as HTMLInputElement;
    input.value = value;
    input.placeholder = placeholder;
    const buttons = el("div", "dialog-buttons");
    const cancel = el("button", "secondary", "Cancel") as HTMLButtonElement;
    const ok = el("button", undefined, "OK") as HTMLButtonElement;
    buttons.append(cancel, ok);
    dialog.append(heading, input, buttons);
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);
    const done = (result: string | null) => {
      backdrop.remove();
      resolve(result);
    };
    input.focus();
    if (value) input.select();
    ok.addEventListener("click", () => done(input.value.trim() || null));
    cancel.addEventListener("click", () => done(null));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") done(input.value.trim() || null);
      if (e.key === "Escape") done(null);
    });
    backdrop.addEventListener("mousedown", (e) => {
      if (e.target === backdrop) done(null);
    });
  });
}

export function confirmDialog(title: string, actionLabel = "Delete"): Promise<boolean> {
  return new Promise((resolve) => {
    const backdrop = el("div", "dialog-backdrop");
    const dialog = el("div", "dialog");
    const heading = el("h3", undefined, title);
    const buttons = el("div", "dialog-buttons");
    const cancel = el("button", "secondary", "Cancel") as HTMLButtonElement;
    const ok = el("button", undefined, actionLabel) as HTMLButtonElement;
    buttons.append(cancel, ok);
    dialog.append(heading, buttons);
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);
    const done = (result: boolean) => {
      backdrop.remove();
      resolve(result);
    };
    cancel.addEventListener("click", () => done(false));
    ok.addEventListener("click", () => done(true));
    backdrop.addEventListener("mousedown", (e) => {
      if (e.target === backdrop) done(false);
    });
    ok.focus();
  });
}
