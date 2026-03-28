"use client";

import { useWorkspaceStore } from "@/stores/workspace";

const STATUS_COLORS: Record<string, string> = {
  connected: "bg-green-500",
  connecting: "bg-yellow-500",
  reconnecting: "bg-yellow-500",
  disconnected: "bg-red-500",
};

const STATUS_LABELS: Record<string, string> = {
  connected: "Connected",
  connecting: "Connecting...",
  reconnecting: "Reconnecting...",
  disconnected: "Disconnected",
};

export function StatusBar() {
  const status = useWorkspaceStore((s) => s.status);
  const cursorPosition = useWorkspaceStore((s) => s.cursorPosition);
  const activeTab = useWorkspaceStore((s) => s.activeTab);
  const openFiles = useWorkspaceStore((s) => s.openFiles);

  const file = activeTab ? openFiles.get(activeTab) : undefined;

  return (
    <div className="flex h-6 shrink-0 items-center justify-between bg-[#007acc] px-2 text-[12px] text-white">
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5">
          <span
            className={`inline-block h-2 w-2 rounded-full ${STATUS_COLORS[status]}`}
          />
          {STATUS_LABELS[status]}
        </span>
      </div>
      <div className="flex items-center gap-3">
        {cursorPosition && (
          <span>
            Ln {cursorPosition.line}, Col {cursorPosition.column}
          </span>
        )}
        {file && <span>{file.language}</span>}
        <span>UTF-8</span>
      </div>
    </div>
  );
}
