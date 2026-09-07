import { el } from "./util";

export type MenuItem = { label: string; run: () => void } | "separator";

export function showContextMenu(x: number, y: number, items: MenuItem[]): void {
  document.querySelectorAll(".context-menu").forEach((m) => m.remove());
  const menu = el("div", "context-menu");
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  let closed = false;
  const onOutside = (e: MouseEvent) => {
    if (!menu.contains(e.target as Node)) close();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") close();
  };
  const close = () => {
    if (closed) return;
    closed = true;
    menu.remove();
    document.removeEventListener("mousedown", onOutside);
    document.removeEventListener("keydown", onKey);
    opener?.focus();
  };
  for (const item of items) {
    if (item === "separator") {
      const sep = el("div");
      sep.style.cssText = "height:1px;background:var(--border);margin:4px 0";
      menu.appendChild(sep);
      continue;
    }
    const row = el("button", "menu-item", item.label);
    row.type = "button";
    row.addEventListener("click", () => {
      close();
      item.run();
    });
    menu.appendChild(row);
  }
  document.body.appendChild(menu);
  const rect = menu.getBoundingClientRect();
  menu.style.left = Math.min(x, window.innerWidth - rect.width - 4) + "px";
  menu.style.top = Math.min(y, window.innerHeight - rect.height - 4) + "px";
  document.addEventListener("mousedown", onOutside);
  document.addEventListener("keydown", onKey);
  const first = menu.querySelector<HTMLElement>(".menu-item");
  if (first) first.focus();
  else opener?.focus();
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

export function saveChangesDialog(title: string): Promise<"save" | "discard" | "cancel"> {
  return new Promise((resolve) => {
    const backdrop = el("div", "dialog-backdrop");
    const dialog = el("div", "dialog");
    const heading = el("h3", undefined, title);
    const buttons = el("div", "dialog-buttons");
    const cancel = el("button", "secondary", "Cancel") as HTMLButtonElement;
    const discard = el("button", "secondary", "Don't Save") as HTMLButtonElement;
    const save = el("button", undefined, "Save") as HTMLButtonElement;
    buttons.append(cancel, discard, save);
    dialog.append(heading, buttons);
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);
    const done = (result: "save" | "discard" | "cancel") => {
      backdrop.remove();
      resolve(result);
    };
    cancel.addEventListener("click", () => done("cancel"));
    discard.addEventListener("click", () => done("discard"));
    save.addEventListener("click", () => done("save"));
    backdrop.addEventListener("mousedown", (e) => {
      if (e.target === backdrop) done("cancel");
    });
    save.focus();
  });
}
