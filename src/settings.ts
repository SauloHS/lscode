export type Settings = {
  theme: "dark" | "light";
  fontSize: number;
};

const DEFAULTS: Settings = { theme: "dark", fontSize: 14 };
const KEY = "lscode.settings";

let current: Settings = load();

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    // fall through to defaults
  }
  return { ...DEFAULTS };
}

export function settings(): Settings {
  return current;
}

export function updateSettings(patch: Partial<Settings>): void {
  current = { ...current, ...patch };
  localStorage.setItem(KEY, JSON.stringify(current));
  apply();
}

export function applySettings(): void {
  apply();
}

function apply(): void {
  document.body.classList.toggle("light", current.theme === "light");
}
