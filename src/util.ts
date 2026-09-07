export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function $(id: string): HTMLElement {
  return document.getElementById(id)!;
}

export function basename(path: string): string {
  const norm = path.replace(/\\/g, "/");
  const parts = norm.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

export function dirname(path: string): string {
  const norm = path.replace(/\\/g, "/");
  const idx = norm.lastIndexOf("/");
  if (idx < 0) return ".";
  if (idx <= 0) return path.includes("\\") && !norm.startsWith("/") ? norm.slice(0, norm.indexOf("\\") + 1) || path : norm.slice(0, idx) || path;
  return norm.slice(0, idx);
}

export function relative(root: string, path: string): string {
  if (path.startsWith(root)) {
    const rest = path.slice(root.length).replace(/^[\\/]+/, "");
    if (rest) return rest.replace(/\\/g, "/");
  }
  return path;
}

export function joinPath(dir: string, name: string): string {
  const sep = dir.includes("\\") && !dir.includes("/") ? "\\" : "/";
  return dir.replace(/[\\/]+$/, "") + sep + name;
}

const LANGUAGES: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  mts: "typescript",
  cts: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  json: "json",
  jsonc: "json",
  css: "css",
  scss: "scss",
  less: "less",
  html: "html",
  htm: "html",
  md: "markdown",
  markdown: "markdown",
  py: "python",
  rs: "rust",
  go: "go",
  java: "java",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  hh: "cpp",
  cs: "csharp",
  php: "php",
  rb: "ruby",
  sh: "shell",
  bash: "shell",
  bat: "bat",
  cmd: "bat",
  ps1: "powershell",
  yaml: "yaml",
  yml: "yaml",
  toml: "ini",
  ini: "ini",
  env: "ini",
  xml: "xml",
  sql: "sql",
  vue: "html",
  svelte: "html",
  swift: "swift",
  kt: "kotlin",
  dart: "dart",
  lua: "lua",
  pl: "perl",
  r: "r",
  txt: "plaintext",
};

export function languageFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return LANGUAGES[ext] ?? "plaintext";
}

export type FuzzyResult = { score: number; positions: number[] } | null;

export function fuzzyMatch(needle: string, haystack: string): FuzzyResult {
  if (!needle) return { score: 0, positions: [] };
  const n = needle.toLowerCase();
  const h = haystack.toLowerCase();
  const positions: number[] = [];
  let score = 0;
  let hi = 0;
  let streak = 0;
  for (let ni = 0; ni < n.length; ni++) {
    const ch = n[ni];
    let found = -1;
    for (let j = hi; j < h.length; j++) {
      if (h[j] === ch) {
        found = j;
        break;
      }
    }
    if (found === -1) return null;
    if (found === hi && ni > 0) streak++;
    else streak = 0;
    score += 10 - Math.min(found - hi, 9);
    score += streak * 5;
    if (found === 0 || "/._- ".includes(h[found - 1])) score += 8;
    positions.push(found);
    hi = found + 1;
  }
  return { score: score - h.length * 0.1, positions };
}
