"use client";

import { useEffect, useRef } from "react";
import type { editor } from "monaco-editor";
import type { CodeChange } from "@/lib/rpc/types";
import { useWorkspaceStore } from "@/stores/workspace";

export function useInlineDiff(
  editorInstance: editor.IStandaloneCodeEditor | null,
  activeFilePath: string | null
) {
  const pendingChanges = useWorkspaceStore((s) => s.pendingChanges);
  const decorationsRef = useRef<editor.IEditorDecorationsCollection | null>(null);
  const widgetsRef = useRef<editor.IContentWidget[]>([]);

  useEffect(() => {
    if (!editorInstance || !activeFilePath) return;

    const model = editorInstance.getModel();
    if (!model) return;

    // Find pending changes for this file
    const fileChanges = pendingChanges.filter(
      (c) => c.filePath === activeFilePath && c.status === "pending"
    );

    // Clear previous decorations
    if (decorationsRef.current) {
      decorationsRef.current.clear();
      decorationsRef.current = null;
    }

    // Remove previous widgets
    for (const widget of widgetsRef.current) {
      editorInstance.removeContentWidget(widget);
    }
    widgetsRef.current = [];

    if (fileChanges.length === 0) return;

    const decorations: editor.IModelDeltaDecoration[] = [];

    for (const change of fileChanges) {
      // Compute which lines differ
      const origLines = change.original.split("\n");
      const modLines = change.modified.split("\n");

      // Find the first differing line
      let startLine = 0;
      while (
        startLine < origLines.length &&
        startLine < modLines.length &&
        origLines[startLine] === modLines[startLine]
      ) {
        startLine++;
      }

      // Find the last differing line (from end)
      let endOrigOffset = 0;
      let endModOffset = 0;
      while (
        endOrigOffset < origLines.length - startLine &&
        endModOffset < modLines.length - startLine &&
        origLines[origLines.length - 1 - endOrigOffset] ===
          modLines[modLines.length - 1 - endModOffset]
      ) {
        endOrigOffset++;
        endModOffset++;
      }

      const diffStartLine = startLine + 1; // 1-indexed
      const diffEndLine = origLines.length - endOrigOffset;

      if (diffStartLine <= diffEndLine) {
        // Highlight the changed region
        decorations.push({
          range: {
            startLineNumber: diffStartLine,
            startColumn: 1,
            endLineNumber: diffEndLine,
            endColumn: model.getLineMaxColumn(Math.min(diffEndLine, model.getLineCount())),
          },
          options: {
            isWholeLine: true,
            className: "inline-diff-modified-line",
            glyphMarginClassName: "inline-diff-glyph",
            overviewRuler: {
              color: "#007acc",
              position: 1, // Center
            },
          },
        });
      }
    }

    if (decorations.length > 0) {
      decorationsRef.current = editorInstance.createDecorationsCollection(decorations);
    }

    return () => {
      if (decorationsRef.current) {
        decorationsRef.current.clear();
        decorationsRef.current = null;
      }
      for (const widget of widgetsRef.current) {
        editorInstance.removeContentWidget(widget);
      }
      widgetsRef.current = [];
    };
  }, [editorInstance, activeFilePath, pendingChanges]);
}
