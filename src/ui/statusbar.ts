import { activeTab, state, subscribe } from "../state";
import { el, $ } from "../util";
import { cursorLabel, eolLabel, languageLabel } from "./editor";

export function initStatusbar(): void {
  const left = $("status-left");
  const right = $("status-right");
  left.innerHTML = "";
  right.innerHTML = "";

  const root = el("span", "status-item");
  const position = el("span", "status-item", "Ln 1, Col 1");
  const spaces = el("span", "status-item", "Spaces: 2");
  const encoding = el("span", "status-item", "UTF-8");
  const eol = el("span", "status-item", "LF");
  const language = el("span", "status-item", "Plain Text");

  left.appendChild(root);
  right.append(position, spaces, encoding, eol, language);

  const render = () => {
    root.textContent = state.root
      ? state.root.replace(/\\/g, "/").split("/").pop() ?? state.root
      : "LS Code";
    position.textContent = cursorLabel() || "Ln 1, Col 1";
    const tab = activeTab();
    spaces.textContent = `Spaces: ${tab ? tab.model.getOptions().tabSize : 2}`;
    eol.textContent = eolLabel();
    language.textContent = languageLabel();
  };
  subscribe(render);
  render();
}
