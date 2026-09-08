import { hasTauriBackend } from "../api";
import { runCommand } from "../commands";
import { el, $ } from "../util";

type MenuEntry = { label: string; run?: () => void; kbd?: string };

type MenuDef = { label: string; entries: (MenuEntry | "separator")[] };

export function initMenubar(): void {
  const defs: MenuDef[] = [
    {
      label: "File",
      entries: [
        { label: "New File…", run: () => runCommand("file.new") },
        { label: "New Folder…", run: () => runCommand("folder.new") },
        { label: "Open Folder…", run: () => runCommand("workbench.openFolder"), kbd: "Ctrl+K Ctrl+O" },
        "separator",
        { label: "Save", run: () => runCommand("file.save"), kbd: "Ctrl+S" },
        { label: "Save All", run: () => runCommand("file.saveAll"), kbd: "Ctrl+K S" },
        "separator",
        { label: "Close Tab", run: () => runCommand("file.closeTab"), kbd: "Ctrl+W" },
        { label: "Close Folder", run: () => runCommand("workbench.closeFolder") },
      ],
    },
    {
      label: "Edit",
      entries: [
        { label: "Undo", run: () => runCommand("edit.undo"), kbd: "Ctrl+Z" },
        { label: "Redo", run: () => runCommand("edit.redo"), kbd: "Ctrl+Y" },
        "separator",
        { label: "Cut", run: () => runCommand("edit.cut"), kbd: "Ctrl+X" },
        { label: "Copy", run: () => runCommand("edit.copy"), kbd: "Ctrl+C" },
        { label: "Paste", run: () => runCommand("edit.paste"), kbd: "Ctrl+V" },
        "separator",
        { label: "Find", run: () => runCommand("edit.find"), kbd: "Ctrl+F" },
        { label: "Replace", run: () => runCommand("edit.replace"), kbd: "Ctrl+H" },
      ],
    },
    {
      label: "View",
      entries: [
        { label: "Command Palette…", run: () => runCommand("workbench.showCommands"), kbd: "Ctrl+Shift+P" },
        { label: "Open View…", run: () => runCommand("workbench.showSearch") },
        "separator",
        { label: "Explorer", run: () => runCommand("workbench.showExplorer"), kbd: "Ctrl+Shift+E" },
        { label: "Search", run: () => runCommand("workbench.showSearch"), kbd: "Ctrl+Shift+F" },
        "separator",
        { label: "Toggle Sidebar", run: () => runCommand("workbench.toggleSidebar"), kbd: "Ctrl+B" },
        ...(hasTauriBackend
          ? [{ label: "Toggle Terminal", run: () => runCommand("workbench.togglePanel"), kbd: "Ctrl+`" }]
          : []),
        { label: "Toggle Theme", run: () => runCommand("workbench.toggleTheme") },
      ],
    },
    ...(hasTauriBackend
      ? [
          {
            label: "Terminal",
            entries: [
              { label: "New Terminal", run: () => runCommand("terminal.new"), kbd: "Ctrl+Shift+`" },
              { label: "Toggle Terminal", run: () => runCommand("workbench.togglePanel"), kbd: "Ctrl+`" },
            ],
          } satisfies MenuDef,
        ]
      : []),
    {
      label: "Help",
      entries: [{ label: "About", run: () => runCommand("help.about") }],
    },
  ];

  const menubar = $("menubar");
  let openDropdown: HTMLElement | null = null;
  let openRoot: HTMLElement | null = null;

  const closeMenu = () => {
    openDropdown?.remove();
    openDropdown = null;
    openRoot?.classList.remove("open");
    openRoot = null;
  };

  for (const def of defs) {
    const root = el("div", "menu-root", def.label);
    root.addEventListener("click", (e) => {
      e.stopPropagation();
      if (openRoot === root) {
        closeMenu();
        return;
      }
      closeMenu();
      const dropdown = el("div", "menu-dropdown");
      for (const entry of def.entries) {
        if (entry === "separator") {
          const sep = el("div");
          sep.style.cssText = "height:1px;background:var(--border);margin:4px 0";
          dropdown.appendChild(sep);
          continue;
        }
        const item = el("div", "menu-item");
        item.appendChild(el("span", undefined, entry.label));
        if (entry.kbd) item.appendChild(el("span", "kbd", entry.kbd));
        item.addEventListener("click", () => {
          closeMenu();
          entry.run?.();
        });
        dropdown.appendChild(item);
      }
      document.body.appendChild(dropdown);
      const rect = root.getBoundingClientRect();
      dropdown.style.left = rect.left + "px";
      dropdown.style.top = rect.bottom + "px";
      openDropdown = dropdown;
      openRoot = root;
      root.classList.add("open");
    });
    menubar.appendChild(root);
  }

  document.addEventListener("click", closeMenu);
}
