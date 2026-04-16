"use client";

import { useWorkspaceStore } from "@/stores/workspace";
import type { SidebarView } from "@/stores/workspace";
import { FileExplorer } from "./FileExplorer";
import { GitPanel } from "./Git/GitPanel";
import { EnvironmentPanel } from "./Environment/EnvironmentPanel";
import { CommissionPanel } from "./Commission/CommissionPanel";
import { ChatPanel } from "./Chat/ChatPanel";

const SIDEBAR_ITEMS: { id: SidebarView; label: string; icon: string }[] = [
  { id: "files", label: "Explorer", icon: "M17.5 0h-9L7 1.5V6H2.5L1 7.5v13l1.5 1.5h13l1.5-1.5V16h4.5l1.5-1.5v-11L17.5 0zM16 14.5l-1.5 1.5H3l-1-.5V8l.5-1H7v7h9v.5zm4-1l-.5.5H9l-1.5-1.5v-11L9 .5h6v4.5h4.5l.5.5v8z" },
  { id: "git", label: "Source Control", icon: "M21.007 8.222A3.738 3.738 0 0 0 15.045 5.2a3.737 3.737 0 0 0 1.156 6.583 2.988 2.988 0 0 1-2.668 1.67h-2.99a4.456 4.456 0 0 0-2.989 1.165V7.4a3.737 3.737 0 1 0-1.494 0v9.117a3.776 3.776 0 1 0 1.816.099 2.99 2.99 0 0 1 2.668-1.667h2.99a4.484 4.484 0 0 0 4.223-3.039 3.736 3.736 0 0 0 3.25-3.687zM4.565 3.738a2.242 2.242 0 1 1 4.484 0 2.242 2.242 0 0 1-4.484 0zm4.484 16.441a2.242 2.242 0 1 1-4.484 0 2.242 2.242 0 0 1 4.484 0zm8.221-9.715a2.242 2.242 0 1 1 0-4.485 2.242 2.242 0 0 1 0 4.485z" },
  { id: "environment", label: "Environment", icon: "M21 7h-2V5H5v2H3V5a2 2 0 012-2h14a2 2 0 012 2v2zm0 4h-2V9H5v2H3V9h18v2zm0 4h-2v-2H5v2H3v-2h18v2zm0 4h-2v-2H5v2H3v-2a2 2 0 002 2h14a2 2 0 002-2z" },
  { id: "commission", label: "Commission", icon: "M5 3l14 9-14 9V3z" },
  { id: "chat", label: "AI Chat", icon: "M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z" },
];

export function Sidebar() {
  const sidebarView = useWorkspaceStore((s) => s.sidebarView);
  const setSidebarView = useWorkspaceStore((s) => s.setSidebarView);

  return (
    <div className="flex h-full">
      {/* Activity Bar */}
      <div className="flex w-12 shrink-0 flex-col items-center gap-1 bg-[#333333] pt-1">
        {SIDEBAR_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            title={item.label}
            className={`flex h-12 w-12 items-center justify-center ${
              sidebarView === item.id
                ? "border-l-2 border-white text-white"
                : "border-l-2 border-transparent text-[#858585] hover:text-white"
            }`}
            onClick={() => setSidebarView(item.id)}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="currentColor"
            >
              <path d={item.icon} />
            </svg>
          </button>
        ))}
      </div>

      {/* Panel */}
      <div className="flex-1 overflow-hidden">
        {sidebarView === "files" && <FileExplorer />}
        {sidebarView === "git" && <GitPanel />}
        {sidebarView === "environment" && <EnvironmentPanel />}
        {sidebarView === "commission" && <CommissionPanel />}
        {sidebarView === "chat" && <ChatPanel />}
      </div>
    </div>
  );
}
