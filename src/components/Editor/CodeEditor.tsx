"use client";

import { useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import type { OnMount, OnChange } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useWorkspaceStore } from "@/stores/workspace";
import { atelierDarkTheme, ATELIER_THEME_NAME } from "@/lib/editor/theme";
import { useInlineDiff } from "@/hooks/useInlineDiff";
import { DiffEditor } from "./DiffEditor";

const MonacoEditor = dynamic(() => import("@monaco-editor/react").then((m) => m.Editor), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-[#858585]">
      Loading editor...
    </div>
  ),
});

function guessLanguage(path: string): string {
  const ext = path.split(".").pop() ?? "";
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescriptreact",
    js: "javascript",
    jsx: "javascriptreact",
    json: "json",
    md: "markdown",
    css: "css",
    html: "html",
  };
  return map[ext] ?? "plaintext";
}

export function CodeEditor() {
  const activeTab = useWorkspaceStore((s) => s.activeTab);
  const openFiles = useWorkspaceStore((s) => s.openFiles);
  const updateContent = useWorkspaceStore((s) => s.updateContent);
  const setCursorPosition = useWorkspaceStore((s) => s.setCursorPosition);
  const diffFile = useWorkspaceStore((s) => s.diffFile);
  const setDiffFile = useWorkspaceStore((s) => s.setDiffFile);

  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  useInlineDiff(editorRef.current, activeTab);

  const file = activeTab ? openFiles.get(activeTab) : undefined;

  const handleMount: OnMount = useCallback(
    (editorInstance, monaco) => {
      editorRef.current = editorInstance;

      monaco.editor.defineTheme(ATELIER_THEME_NAME, atelierDarkTheme);
      monaco.editor.setTheme(ATELIER_THEME_NAME);

      editorInstance.onDidChangeCursorPosition((e) => {
        setCursorPosition({
          line: e.position.lineNumber,
          column: e.position.column,
        });
      });
    },
    [setCursorPosition]
  );

  const handleChange: OnChange = useCallback(
    (value) => {
      if (activeTab && value !== undefined) {
        updateContent(activeTab, value);
      }
    },
    [activeTab, updateContent]
  );

  // Diff モード
  if (diffFile) {
    const language = guessLanguage(diffFile.path);
    return (
      <div className="flex h-full flex-col">
        <div className="flex h-8 shrink-0 items-center justify-between bg-[#252526] px-3">
          <span className="text-[12px] text-[#cccccc]">
            Diff: {diffFile.path}
          </span>
          <button
            type="button"
            className="rounded px-2 py-0.5 text-[11px] text-[#969696] hover:bg-[#3c3c3c] hover:text-white"
            onClick={() => setDiffFile(null)}
          >
            Close Diff
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <DiffEditor
            original={diffFile.original}
            modified={diffFile.modified}
            language={language}
            path={diffFile.path}
          />
        </div>
      </div>
    );
  }

  if (!file) {
    return (
      <div className="flex h-full items-center justify-center text-[#858585]">
        <div className="text-center">
          <p className="text-lg">ATELIER Editor</p>
          <p className="mt-2 text-sm">Open a file from the explorer to start editing</p>
        </div>
      </div>
    );
  }

  return (
    <MonacoEditor
      key={file.path}
      defaultValue={file.content}
      language={file.language}
      theme={ATELIER_THEME_NAME}
      onMount={handleMount}
      onChange={handleChange}
      options={{
        fontSize: 14,
        lineHeight: 20,
        minimap: { enabled: true },
        scrollBeyondLastLine: false,
        wordWrap: "off",
        tabSize: 2,
        automaticLayout: true,
        padding: { top: 8 },
      }}
    />
  );
}
