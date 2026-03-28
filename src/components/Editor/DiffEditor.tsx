"use client";

import dynamic from "next/dynamic";
import type { DiffOnMount } from "@monaco-editor/react";
import { useCallback } from "react";
import { atelierDarkTheme, ATELIER_THEME_NAME } from "@/lib/editor/theme";

const MonacoDiffEditor = dynamic(
  () => import("@monaco-editor/react").then((m) => m.DiffEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-[#858585]">
        Loading diff...
      </div>
    ),
  }
);

interface DiffEditorProps {
  original: string;
  modified: string;
  language: string;
  path: string;
}

export function DiffEditor({ original, modified, language, path }: DiffEditorProps) {
  const handleMount: DiffOnMount = useCallback((_editor, monaco) => {
    monaco.editor.defineTheme(ATELIER_THEME_NAME, atelierDarkTheme);
    monaco.editor.setTheme(ATELIER_THEME_NAME);
  }, []);

  return (
    <MonacoDiffEditor
      key={path}
      original={original}
      modified={modified}
      language={language}
      theme={ATELIER_THEME_NAME}
      onMount={handleMount}
      options={{
        readOnly: true,
        fontSize: 14,
        lineHeight: 20,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        renderSideBySide: true,
        padding: { top: 8 },
      }}
    />
  );
}
