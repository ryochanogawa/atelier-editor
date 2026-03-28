"use client";

import { useConnection } from "@/hooks/useConnection";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { FileExplorer } from "./FileExplorer";
import { TabBar } from "./TabBar";
import { CodeEditor } from "./CodeEditor";
import { StatusBar } from "./StatusBar";

export function EditorLayout() {
  useConnection();
  useKeyboardShortcuts();

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#1e1e1e]">
      {/* Main area: sidebar + editor */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className="shrink-0 overflow-hidden border-r border-[#1e1e1e]"
          style={{ width: "var(--sidebar-width, 240px)" }}
        >
          <FileExplorer />
        </aside>

        {/* Editor area */}
        <main className="flex flex-1 flex-col overflow-hidden">
          <TabBar />
          <div className="flex-1 overflow-hidden">
            <CodeEditor />
          </div>
        </main>
      </div>

      {/* Status bar */}
      <StatusBar />
    </div>
  );
}
