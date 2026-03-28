"use client";

import { useCallback } from "react";
import { useWorkspaceStore } from "@/stores/workspace";
import { getRpcClient } from "@/lib/rpc/client";
import { FileTreeNode } from "./FileTreeNode";

export function FileExplorer() {
  const tree = useWorkspaceStore((s) => s.tree);
  const toggleExpand = useWorkspaceStore((s) => s.toggleExpand);
  const addTab = useWorkspaceStore((s) => s.addTab);
  const openFile = useWorkspaceStore((s) => s.openFile);

  const handleToggle = useCallback(
    (path: string) => {
      toggleExpand(path);
    },
    [toggleExpand]
  );

  const handleFileSelect = useCallback(
    async (path: string) => {
      const { openFiles } = useWorkspaceStore.getState();
      // 既に開いているファイルはタブをアクティブにするだけ
      if (openFiles.has(path)) {
        addTab(path);
        return;
      }

      try {
        const client = getRpcClient();
        const fileContent = await client.call("fs.readFile", { path });
        openFile(fileContent);
        addTab(path);
      } catch (err) {
        console.error("Failed to read file:", err);
      }
    },
    [openFile, addTab]
  );

  const workspaceName = useWorkspaceStore((s) => s.workspaceInfo?.name ?? "Explorer");

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#252526]">
      <div className="flex h-9 shrink-0 items-center px-4 text-[11px] font-semibold uppercase tracking-wider text-[#bbbbbb]">
        {workspaceName}
      </div>
      <nav className="flex-1 overflow-y-auto overflow-x-hidden" aria-label="File explorer">
        <ul role="tree" className="pb-4">
          {tree.map((entry) => (
            <FileTreeNode
              key={entry.path}
              entry={entry}
              depth={0}
              onToggle={handleToggle}
              onFileSelect={handleFileSelect}
            />
          ))}
        </ul>
      </nav>
    </div>
  );
}
