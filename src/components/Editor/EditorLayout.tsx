"use client";

import { useCallback } from "react";
import { useConnection } from "@/hooks/useConnection";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useWorkspaceStore } from "@/stores/workspace";
import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";
import { CodeEditor } from "./CodeEditor";
import { StatusBar } from "./StatusBar";
import { WorktreeSelector } from "./WorktreeSelector";
import { ToastContainer } from "./ToastContainer";
import { TerminalPanel } from "./Terminal/TerminalPanel";
import { ResizeHandle } from "./Terminal/ResizeHandle";

const MIN_TERMINAL_HEIGHT = 100;
const MAX_TERMINAL_RATIO = 0.7;

export function EditorLayout() {
  useConnection();
  useKeyboardShortcuts();

  const terminalVisible = useWorkspaceStore((s) => s.terminalVisible);
  const terminalHeight = useWorkspaceStore((s) => s.terminalHeight);
  const setTerminalHeight = useWorkspaceStore((s) => s.setTerminalHeight);

  const handleResize = useCallback(
    (deltaY: number) => {
      setTerminalHeight(
        Math.max(
          MIN_TERMINAL_HEIGHT,
          Math.min(window.innerHeight * MAX_TERMINAL_RATIO, terminalHeight + deltaY)
        )
      );
    },
    [terminalHeight, setTerminalHeight]
  );

  const handleResizeEnd = useCallback(() => {
    // future: persist to localStorage
  }, []);

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

        {/* Editor + Terminal area */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {/* Editor section */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <TabBar />
            <div className="flex-1 overflow-hidden">
              <CodeEditor />
            </div>
          </div>

          {/* Terminal section */}
          {terminalVisible && (
            <>
              <ResizeHandle onResize={handleResize} onResizeEnd={handleResizeEnd} />
              <div className="shrink-0 overflow-hidden" style={{ height: terminalHeight }}>
                <TerminalPanel />
              </div>
            </>
          )}
        </main>
      </div>

      {/* Status bar */}
      <StatusBar />

      {/* Toast notifications */}
      <ToastContainer />
    </div>
  );
}
