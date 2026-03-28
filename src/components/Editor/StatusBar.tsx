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
  const currentBranch = useWorkspaceStore((s) => s.currentBranch);
  const setSidebarView = useWorkspaceStore((s) => s.setSidebarView);

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
        {currentBranch && (
          <button
            type="button"
            className="flex items-center gap-1 hover:opacity-80"
            onClick={() => setSidebarView("git")}
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
              <path d="M21.007 8.222A3.738 3.738 0 0 0 15.045 5.2a3.737 3.737 0 0 0 1.156 6.583 2.988 2.988 0 0 1-2.668 1.67h-2.99a4.456 4.456 0 0 0-2.989 1.165V7.4a3.737 3.737 0 1 0-1.494 0v9.117a3.776 3.776 0 1 0 1.816.099 2.99 2.99 0 0 1 2.668-1.667h2.99a4.484 4.484 0 0 0 4.223-3.039 3.736 3.736 0 0 0 3.25-3.687zM4.565 3.738a2.242 2.242 0 1 1 4.484 0 2.242 2.242 0 0 1-4.484 0zm4.484 16.441a2.242 2.242 0 1 1-4.484 0 2.242 2.242 0 0 1 4.484 0zm8.221-9.715a2.242 2.242 0 1 1 0-4.485 2.242 2.242 0 0 1 0 4.485z" />
            </svg>
            <span>{currentBranch.name}</span>
            {(currentBranch.ahead ?? 0) > 0 && (
              <span>↑{currentBranch.ahead}</span>
            )}
            {(currentBranch.behind ?? 0) > 0 && (
              <span>↓{currentBranch.behind}</span>
            )}
          </button>
        )}
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
