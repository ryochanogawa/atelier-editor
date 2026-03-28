"use client";

import { useEffect } from "react";
import { getRpcClient } from "@/lib/rpc/client";
import { useWorkspaceStore } from "@/stores/workspace";

export function useKeyboardShortcuts(): void {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      const isMod = e.metaKey || e.ctrlKey;

      // Cmd+S: ファイル保存
      if (isMod && e.key === "s") {
        e.preventDefault();
        saveActiveFile();
      }

      // Cmd+W: タブを閉じる
      if (isMod && e.key === "w") {
        e.preventDefault();
        closeActiveTab();
      }

      // Ctrl+`: ターミナルトグル
      if (isMod && e.key === "`") {
        e.preventDefault();
        useWorkspaceStore.getState().toggleTerminal();
      }
    }

    async function saveActiveFile(): Promise<void> {
      const { activeTab, openFiles, markSaved } = useWorkspaceStore.getState();
      if (!activeTab) return;

      const file = openFiles.get(activeTab);
      if (!file) return;

      // dirty でない場合はスキップ
      if (file.content === file.originalContent) return;

      try {
        const client = getRpcClient();
        await client.call("fs.writeFile", {
          path: activeTab,
          content: file.content,
        });
        markSaved(activeTab);
      } catch (err) {
        console.error("Failed to save file:", err);
      }
    }

    function closeActiveTab(): void {
      const { activeTab, closeFile } = useWorkspaceStore.getState();
      if (!activeTab) return;
      closeFile(activeTab);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);
}
