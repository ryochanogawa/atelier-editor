"use client";

import { useEffect, useRef, useCallback } from "react";
import { getRpcClient } from "@/lib/rpc/client";
import { useWorkspaceStore } from "@/stores/workspace";
import type { Terminal as XTermTerminal } from "@xterm/xterm";
import type { FitAddon as FitAddonType } from "@xterm/addon-fit";

interface TerminalInstanceProps {
  sessionId: string;
  isActive: boolean;
}

export function TerminalInstance({ sessionId, isActive }: TerminalInstanceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTermTerminal | null>(null);
  const fitAddonRef = useRef<FitAddonType | null>(null);
  const initializedRef = useRef(false);

  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleResize = useCallback(() => {
    if (!fitAddonRef.current || !termRef.current || !isActive) return;

    if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
    resizeTimerRef.current = setTimeout(() => {
      try {
        fitAddonRef.current?.fit();
        if (termRef.current) {
          const { cols, rows } = termRef.current;
          getRpcClient().call("terminal.resize", { sessionId, cols, rows }).catch(() => {});
        }
      } catch {
        // fit can throw if container is hidden
      }
    }, 150);
  }, [sessionId, isActive]);

  useEffect(() => {
    if (!containerRef.current || initializedRef.current) return;
    initializedRef.current = true;

    let term: XTermTerminal;
    let fitAddon: FitAddonType;
    let disposed = false;

    async function init() {
      const { Terminal } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");

      if (disposed) return;

      term = new Terminal({
        fontSize: 13,
        lineHeight: 1.4,
        fontFamily: "'Menlo', 'Monaco', 'Courier New', monospace",
        theme: {
          background: "#1e1e1e",
          foreground: "#cccccc",
          cursor: "#cccccc",
          selectionBackground: "#264f78",
          black: "#000000",
          red: "#f44747",
          green: "#6a9955",
          yellow: "#dcdcaa",
          blue: "#569cd6",
          magenta: "#c586c0",
          cyan: "#4ec9b0",
          white: "#d4d4d4",
          brightBlack: "#808080",
          brightRed: "#f44747",
          brightGreen: "#6a9955",
          brightYellow: "#dcdcaa",
          brightBlue: "#569cd6",
          brightMagenta: "#c586c0",
          brightCyan: "#4ec9b0",
          brightWhite: "#ffffff",
        },
        cursorBlink: true,
        scrollback: 5000,
      });

      fitAddon = new FitAddon();
      term.loadAddon(fitAddon);

      termRef.current = term;
      fitAddonRef.current = fitAddon;

      if (containerRef.current) {
        term.open(containerRef.current);
        fitAddon.fit();
      }

      // ユーザー入力をサーバーへ送信
      term.onData((data) => {
        getRpcClient()
          .call("terminal.input", { sessionId, data })
          .catch(() => {});
      });

      // terminal.output 通知を購読
      const client = getRpcClient();
      const unsubOutput = client.onNotification("terminal.output", (params) => {
        if (params.sessionId === sessionId) {
          term.write(params.data);
        }
      });

      const unsubExit = client.onNotification("terminal.exit", (params) => {
        if (params.sessionId === sessionId) {
          term.write(`\r\n\x1b[90m[Process exited with code ${params.exitCode}]\x1b[0m\r\n`);
          useWorkspaceStore.getState().markTerminalExited(sessionId);
        }
      });

      // cleanup用に保存
      (term as unknown as Record<string, unknown>).__unsubs = [unsubOutput, unsubExit];
    }

    init();

    return () => {
      disposed = true;
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
      if (termRef.current) {
        const unsubs = (termRef.current as unknown as Record<string, (() => void)[]>).__unsubs;
        if (unsubs) unsubs.forEach((u) => u());
        termRef.current.dispose();
        termRef.current = null;
      }
      fitAddonRef.current = null;
      initializedRef.current = false;
    };
  }, [sessionId]);

  // リサイズ監視
  useEffect(() => {
    if (!isActive) return;

    // アクティブになったらfitし直す
    const timer = setTimeout(handleResize, 50);

    const observer = new ResizeObserver(() => handleResize());
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [isActive, handleResize]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{ display: isActive ? "block" : "none" }}
    />
  );
}
