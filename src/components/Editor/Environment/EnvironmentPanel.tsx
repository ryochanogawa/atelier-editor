"use client";

import { useEffect, useState } from "react";
import { useWorkspaceStore } from "@/stores/workspace";
import { getRpcClient } from "@/lib/rpc/client";
import { EnvironmentCard } from "./EnvironmentCard";
import { BuildLogViewer } from "./BuildLogViewer";

export function EnvironmentPanel() {
  const environments = useWorkspaceStore((s) => s.environments);
  const buildLogs = useWorkspaceStore((s) => s.buildLogs);
  const environmentPanelTab = useWorkspaceStore((s) => s.environmentPanelTab);
  const setEnvironmentPanelTab = useWorkspaceStore((s) => s.setEnvironmentPanelTab);
  const [logWorktreeId, setLogWorktreeId] = useState<string | null>(null);

  const envEntries = Object.values(environments);
  const hasEnvironments = envEntries.length > 0;

  // 環境ステータスの初期取得
  useEffect(() => {
    const client = getRpcClient();
    client.call("environment.status", {} as Record<string, never>).then((states) => {
      const store = useWorkspaceStore.getState;
      for (const [id, state] of Object.entries(states)) {
        store().setEnvironmentConfig(id, state.config!);
        store().setEnvironmentStatus(id, state.status, {
          hostPort: state.hostPort ?? undefined,
          containerId: state.containerId ?? undefined,
          error: state.error ?? undefined,
        });
      }
    }).catch(() => {
      // サイレントに失敗
    });
  }, []);

  function handleViewLogs(worktreeId: string) {
    setLogWorktreeId(worktreeId);
    setEnvironmentPanelTab("logs");

    // サーバーからログを取得
    const client = getRpcClient();
    client.call("environment.logs", { worktreeId }).catch(() => {
      // サイレントに失敗
    });
  }

  function handleBackToOverview() {
    setEnvironmentPanelTab("overview");
    setLogWorktreeId(null);
  }

  return (
    <div className="flex h-full flex-col bg-[#1e1e1e]">
      {/* Header */}
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-[#3c3c3c] px-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-[#bbb]">
          Environment
        </span>
        {environmentPanelTab === "logs" && (
          <button
            type="button"
            onClick={handleBackToOverview}
            className="text-[10px] text-[#0e639c] hover:text-[#1177bb]"
          >
            Overview
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex shrink-0 border-b border-[#3c3c3c]">
        <TabButton
          active={environmentPanelTab === "overview"}
          onClick={() => { setEnvironmentPanelTab("overview"); setLogWorktreeId(null); }}
        >
          Overview
        </TabButton>
        <TabButton
          active={environmentPanelTab === "logs"}
          onClick={() => setEnvironmentPanelTab("logs")}
        >
          Logs
        </TabButton>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {environmentPanelTab === "overview" && (
          <div className="space-y-2 p-2">
            {!hasEnvironments ? (
              <div className="px-2 py-8 text-center">
                <div className="mb-2 text-[#666]">
                  <svg viewBox="0 0 24 24" className="mx-auto h-8 w-8" fill="currentColor">
                    <path d="M21 7h-2V5H5v2H3V5a2 2 0 012-2h14a2 2 0 012 2v2zm0 4h-2V9H5v2H3V9h18v2zm0 4h-2v-2H5v2H3v-2h18v2zm0 4h-2v-2H5v2H3v-2a2 2 0 002 2h14a2 2 0 002-2z" />
                  </svg>
                </div>
                <p className="text-xs text-[#888]">環境が設定されていません</p>
                <p className="mt-1 text-[10px] text-[#666]">
                  .atelier/environment.yml を作成してください
                </p>
              </div>
            ) : (
              envEntries.map((env) => (
                <EnvironmentCard
                  key={env.worktreeId}
                  env={env}
                  onViewLogs={handleViewLogs}
                />
              ))
            )}
          </div>
        )}

        {environmentPanelTab === "logs" && (
          <div className="h-full">
            {logWorktreeId ? (
              <BuildLogViewer logs={buildLogs[logWorktreeId] ?? []} />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-[#666]">
                環境カードから「Logs」をクリックしてください
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-[11px] transition-colors ${
        active
          ? "border-b-2 border-[#0e639c] text-[#e0e0e0]"
          : "border-b-2 border-transparent text-[#888] hover:text-[#ccc]"
      }`}
    >
      {children}
    </button>
  );
}
