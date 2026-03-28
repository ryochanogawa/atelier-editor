"use client";

import { useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import type { OnMount, OnChange } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useWorkspaceStore } from "@/stores/workspace";
import { atelierDarkTheme, ATELIER_THEME_NAME } from "@/lib/editor/theme";

const MonacoEditor = dynamic(() => import("@monaco-editor/react").then((m) => m.Editor), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-[#858585]">
      Loading editor...
    </div>
  ),
});

export function CodeEditor() {
  const activeTab = useWorkspaceStore((s) => s.activeTab);
  const openFiles = useWorkspaceStore((s) => s.openFiles);
  const updateContent = useWorkspaceStore((s) => s.updateContent);
  const setCursorPosition = useWorkspaceStore((s) => s.setCursorPosition);

  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const file = activeTab ? openFiles.get(activeTab) : undefined;

  const handleMount: OnMount = useCallback(
    (editorInstance, monaco) => {
      editorRef.current = editorInstance;

      // テーマ登録
      monaco.editor.defineTheme(ATELIER_THEME_NAME, atelierDarkTheme);
      monaco.editor.setTheme(ATELIER_THEME_NAME);

      // カーソル位置追跡
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
