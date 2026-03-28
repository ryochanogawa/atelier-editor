"use client";

import { useCallback, useEffect, useRef } from "react";
import { useWorkspaceStore } from "@/stores/workspace";
import { getRpcClient } from "@/lib/rpc/client";
import { TerminalInstance } from "./TerminalInstance";

export function TerminalPanel() {
  const sessions = useWorkspaceStore((s) => s.terminalSessions);
  const activeTerminalId = useWorkspaceStore((s) => s.activeTerminalId);
  const setActiveTerminalId = useWorkspaceStore((s) => s.setActiveTerminalId);
  const addTerminalSession = useWorkspaceStore((s) => s.addTerminalSession);
  const removeTerminalSession = useWorkspaceStore((s) => s.removeTerminalSession);
  const setTerminalVisible = useWorkspaceStore((s) => s.setTerminalVisible);
  const status = useWorkspaceStore((s) => s.status);

  const autoCreatedRef = useRef(false);

  const createTerminal = useCallback(async () => {
    try {
      const { sessionId } = await getRpcClient().call("terminal.create", {});
      addTerminalSession(sessionId);
    } catch (err) {
      console.error("Failed to create terminal:", err);
    }
  }, [addTerminalSession]);

  // セッション0件のとき自動作成
  useEffect(() => {
    if (sessions.length === 0 && status === "connected" && !autoCreatedRef.current) {
      autoCreatedRef.current = true;
      createTerminal();
    }
    if (sessions.length > 0) {
      autoCreatedRef.current = false;
    }
  }, [sessions.length, status, createTerminal]);

  const killTerminal = useCallback(
    async (sessionId: string) => {
      try {
        await getRpcClient().call("terminal.kill", { sessionId });
      } catch {
        // already dead
      }
      removeTerminalSession(sessionId);
    },
    [removeTerminalSession]
  );

  return (
    <div className="flex h-full flex-col bg-[#1e1e1e]">
      {/* Terminal tabs header */}
      <div className="flex h-8 shrink-0 items-center border-t border-[#3c3c3c] bg-[#252526]">
        <span className="px-3 text-[11px] font-medium uppercase tracking-wider text-[#cccccc]">
          Terminal
        </span>

        <div className="flex flex-1 items-center gap-0.5 overflow-x-auto px-1">
          {sessions.map((session, i) => (
            <div
              key={session.sessionId}
              className={`group flex h-6 items-center gap-1 rounded px-2 text-[12px] ${
                activeTerminalId === session.sessionId
                  ? "bg-[#1e1e1e] text-white"
                  : "text-[#969696] hover:text-[#cccccc]"
              } ${!session.active ? "opacity-50" : ""}`}
            >
              <button
                type="button"
                className="truncate"
                onClick={() => setActiveTerminalId(session.sessionId)}
              >
                bash ({i + 1})
                {!session.active && (
                  <span className="ml-1 text-[10px] text-[#858585]">exited</span>
                )}
              </button>
              <button
                type="button"
                className="ml-1 opacity-0 group-hover:opacity-100 hover:text-[#f44747]"
                onClick={() => killTerminal(session.sessionId)}
                title="Kill terminal"
              >
                <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor">
                  <path d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.707.708L7.293 8l-3.646 3.646.707.708L8 8.707z" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-1 px-2">
          {/* New terminal button */}
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded text-[#969696] hover:bg-[#3c3c3c] hover:text-white"
            onClick={createTerminal}
            title="New Terminal"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
              <path d="M14 7v1H8v6H7V8H1V7h6V1h1v6h6z" />
            </svg>
          </button>
          {/* Close panel button */}
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded text-[#969696] hover:bg-[#3c3c3c] hover:text-white"
            onClick={() => setTerminalVisible(false)}
            title="Close Panel"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
              <path d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.707.708L7.293 8l-3.646 3.646.707.708L8 8.707z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Terminal content area */}
      <div className="relative flex-1 overflow-hidden">
        {sessions.length === 0 ? (
          <div className="flex h-full items-center justify-center text-[#858585]">
            <button
              type="button"
              className="rounded border border-[#3c3c3c] px-4 py-2 text-sm hover:bg-[#2a2a2a]"
              onClick={createTerminal}
            >
              Create Terminal
            </button>
          </div>
        ) : (
          sessions.map((session) => (
            <TerminalInstance
              key={session.sessionId}
              sessionId={session.sessionId}
              isActive={activeTerminalId === session.sessionId}
            />
          ))
        )}
      </div>
    </div>
  );
}
