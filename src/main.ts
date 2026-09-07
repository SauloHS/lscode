import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";

const monacoEnvironment: monaco.Environment = {
  getWorker(_moduleId: string, label: string) {
    switch (label) {
      case "typescript":
      case "javascript":
        return new tsWorker();
      case "css":
      case "scss":
      case "less":
        return new cssWorker();
      case "html":
      case "handlebars":
      case "razor":
        return new htmlWorker();
      case "json":
        return new jsonWorker();
      default:
        return new editorWorker();
    }
  },
};

self.MonacoEnvironment = monacoEnvironment;

monaco.editor.create(document.getElementById("editor")!, {
  value: [
    "function greet(name: string): string {",
    "  return `Hello, ${name}!`;",
    "}",
    "",
    "greet('LS Code');",
  ].join("\n"),
  language: "typescript",
  theme: "vs-dark",
  automaticLayout: true,
});
