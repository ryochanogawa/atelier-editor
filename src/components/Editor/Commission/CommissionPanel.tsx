"use client";

import { useCallback, useEffect, useRef } from "react";
import { useWorkspaceStore } from "@/stores/workspace";
import { getRpcClient } from "@/lib/rpc/client";
import { CommissionSelector } from "./CommissionSelector";
import { CommissionProgress } from "./CommissionProgress";
import { CommissionStrokeList } from "./CommissionStrokeList";
import { CommissionResult } from "./CommissionResult";

export function CommissionPanel() {
  const commissionDefinitions = useWorkspaceStore((s) => s.commissionDefinitions);
  const commissionDefinitionsLoading = useWorkspaceStore((s) => s.commissionDefinitionsLoading);
  const commissionDefinitionsError = useWorkspaceStore((s) => s.commissionDefinitionsError);
  const setCommissionDefinitions = useWorkspaceStore((s) => s.setCommissionDefinitions);
  const setCommissionDefinitionsLoading = useWorkspaceStore((s) => s.setCommissionDefinitionsLoading);
  const setCommissionDefinitionsError = useWorkspaceStore((s) => s.setCommissionDefinitionsError);
  const activeCommissionId = useWorkspaceStore((s) => s.activeCommissionId);
  const commissionStatus = useWorkspaceStore((s) => s.commissionStatus);
  const addToast = useWorkspaceStore((s) => s.addToast);
  const startCommission = useWorkspaceStore((s) => s.startCommission);
  const clearCommission = useWorkspaceStore((s) => s.clearCommission);
  const activeWorktreeId = useWorkspaceStore((s) => s.activeWorktreeId);
  const connectionStatus = useWorkspaceStore((s) => s.status);

  // staleリクエスト防止用のカウンター
  const fetchIdRef = useRef(0);

  const fetchCommissions = useCallback(async () => {
    if (connectionStatus !== "connected") return;

    const fetchId = ++fetchIdRef.current;
    setCommissionDefinitionsLoading(true);
    setCommissionDefinitionsError(null);

    try {
      const client = getRpcClient();
      const defs = await client.call("commission.list", {
        worktreeId: activeWorktreeId ?? undefined,
      });
      // staleレスポンスを無視: 新しいリクエストが発行済みなら結果を捨てる
      if (fetchId !== fetchIdRef.current) return;
      setCommissionDefinitions(defs);
    } catch (err) {
      if (fetchId !== fetchIdRef.current) return;
      const message = err instanceof Error ? err.message : "Failed to load commissions";
      setCommissionDefinitionsError(message);
    }
  }, [connectionStatus, activeWorktreeId, setCommissionDefinitions, setCommissionDefinitionsLoading, setCommissionDefinitionsError]);

  // worktreeId または接続状態の変更時にリフレッシュ
  useEffect(() => {
    fetchCommissions();
  }, [fetchCommissions]);

  const isRunning = commissionStatus === "running";

  const handleRun = useCallback(
    async (commissionName: string) => {
      try {
        const client = getRpcClient();
        const { commissionId } = await client.call("commission.run", {
          commissionName,
          worktreeId: activeWorktreeId ?? undefined,
        });
        startCommission(commissionId);
        addToast(`Commission started: ${commissionName}`, "info");
      } catch (err) {
        addToast(
          err instanceof Error ? err.message : "Failed to start commission",
          "error"
        );
      }
    },
    [activeWorktreeId, startCommission, addToast]
  );

  const handleAbort = useCallback(async () => {
    if (!activeCommissionId) return;
    try {
      const client = getRpcClient();
      await client.call("commission.abort", { commissionId: activeCommissionId });
      addToast("Commission abort requested", "info");
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : "Failed to abort commission",
        "error"
      );
    }
  }, [activeCommissionId, addToast]);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#252526]">
      <div className="flex h-9 shrink-0 items-center justify-between px-4">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#bbbbbb]">
          Commission
        </span>
        <button
          type="button"
          className="text-[#bbbbbb] hover:text-white disabled:opacity-40"
          onClick={fetchCommissions}
          disabled={commissionDefinitionsLoading}
          title="Refresh commission list"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M13.451 5.609l-.579-.939-1.068.812-.076.094c.335.569.541 1.215.612 1.907.123 1.199-.259 2.385-1.076 3.34-.818.956-1.933 1.534-3.14 1.627l-.243.012c-.672 0-1.322-.165-1.913-.48l-.059-.033 1.02-.983-.79-.19-2.575-.614-.345-.083.083.345.614 2.576.19.79.984-1.02.033.058c.858.456 1.807.694 2.782.694l.298-.015c1.467-.113 2.823-.816 3.819-1.98.995-1.163 1.459-2.607 1.308-4.066a5.524 5.524 0 0 0-.679-2.042zm-1.158 7.209l-.058-.034c-.858-.456-1.808-.694-2.783-.694l-.298.015c-1.467.113-2.823.816-3.819 1.98-.995 1.163-1.458 2.607-1.308 4.066.135 1.323.655 2.49 1.258 3.042l.579.938 1.068-.812.076-.094a5.037 5.037 0 0 1-.612-1.907c-.123-1.199.259-2.385 1.076-3.34.818-.956 1.933-1.534 3.14-1.627l.243-.012c.672 0 1.322.165 1.913.48l.059.033-1.02.983.79.19 2.575.614.345.083-.083-.345-.614-2.576-.19-.79-.984 1.02z" transform="translate(0 -4)" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <CommissionSelector
          definitions={commissionDefinitions}
          loading={commissionDefinitionsLoading}
          error={commissionDefinitionsError}
          onRun={handleRun}
          onAbort={handleAbort}
          onRetry={fetchCommissions}
          isRunning={isRunning}
        />

        {commissionStatus && (
          <>
            <CommissionProgress />
            <CommissionStrokeList />
          </>
        )}

        {commissionStatus && commissionStatus !== "running" && (
          <>
            <CommissionResult />
            <div className="border-t border-[#3c3c3c] px-3 py-2">
              <button
                type="button"
                className="w-full rounded bg-[#3c3c3c] px-3 py-1 text-[12px] text-[#cccccc] hover:bg-[#4c4c4c]"
                onClick={clearCommission}
              >
                Clear
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
