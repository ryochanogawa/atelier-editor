import type { editor } from "monaco-editor";

export const atelierDarkTheme: editor.IStandaloneThemeData = {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "comment", foreground: "6A9955" },
    { token: "keyword", foreground: "569CD6" },
    { token: "string", foreground: "CE9178" },
    { token: "number", foreground: "B5CEA8" },
    { token: "type", foreground: "4EC9B0" },
    { token: "function", foreground: "DCDCAA" },
    { token: "variable", foreground: "9CDCFE" },
  ],
  colors: {
    "editor.background": "#1e1e1e",
    "editor.foreground": "#d4d4d4",
    "editor.lineHighlightBackground": "#2a2d2e",
    "editorCursor.foreground": "#aeafad",
    "editor.selectionBackground": "#264f78",
    "editor.inactiveSelectionBackground": "#3a3d41",
    "editorLineNumber.foreground": "#858585",
    "editorLineNumber.activeForeground": "#c6c6c6",
  },
};

export const ATELIER_THEME_NAME = "atelier-dark";
