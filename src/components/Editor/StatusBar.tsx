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
  const toggleTerminal = useWorkspaceStore((s) => s.toggleTerminal);
  const togglePreview = useWorkspaceStore((s) => s.togglePreview);
  const previewVisible = useWorkspaceStore((s) => s.previewVisible);
  const devServerStatus = useWorkspaceStore((s) => s.devServerStatus);

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
        <button
          type="button"
          className={`flex items-center gap-1 hover:opacity-80 ${previewVisible ? "text-white" : ""}`}
          onClick={togglePreview}
          title="Toggle Preview"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor">
            <path d="M2 3h5v2H3v6h4v2H2a1 1 0 01-1-1V4a1 1 0 011-1zm7 0h5a1 1 0 011 1v8a1 1 0 01-1 1H9v-2h4V5H9V3z" />
          </svg>
          {devServerStatus === "running" && (
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400" />
          )}
        </button>
        <button
          type="button"
          className="flex items-center gap-1 hover:opacity-80"
          onClick={toggleTerminal}
          title="Toggle Terminal (Ctrl+`)"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor">
            <path d="M6 9l3-3-3-3-.707.707L7.586 6 5.293 8.293 6 9zm4 1H6v1h4v-1z" />
            <path d="M1 2.5A1.5 1.5 0 012.5 1h11A1.5 1.5 0 0115 2.5v11a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 13.5v-11zM2.5 2a.5.5 0 00-.5.5v11a.5.5 0 00.5.5h11a.5.5 0 00.5-.5v-11a.5.5 0 00-.5-.5h-11z" />
          </svg>
        </button>
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
