"use client";

import { useConnection } from "@/hooks/useConnection";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";
import { CodeEditor } from "./CodeEditor";
import { StatusBar } from "./StatusBar";
import { WorktreeSelector } from "./WorktreeSelector";
import { ToastContainer } from "./ToastContainer";

export function EditorLayout() {
  useConnection();
  useKeyboardShortcuts();

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#1e1e1e]">
      {/* Header bar */}
      <header className="flex h-8 shrink-0 items-center border-b border-[#1e1e1e] bg-[#333333] px-3">
        <WorktreeSelector />
      </header>

      {/* Main area: sidebar + editor */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar (Activity Bar + Panel) */}
        <aside
          className="shrink-0 overflow-hidden border-r border-[#1e1e1e]"
          style={{ width: "calc(48px + var(--sidebar-width, 240px))" }}
        >
          <Sidebar />
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

      {/* Toast notifications */}
      <ToastContainer />
    </div>
  );
}
