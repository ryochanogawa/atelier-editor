"use client";

import { useCallback, useEffect } from "react";
import { useWorkspaceStore } from "@/stores/workspace";
import { getRpcClient } from "@/lib/rpc/client";
import { CommissionSelector } from "./CommissionSelector";
import { CommissionProgress } from "./CommissionProgress";
import { CommissionStrokeList } from "./CommissionStrokeList";
import { CommissionResult } from "./CommissionResult";

export function CommissionPanel() {
  const commissionDefinitions = useWorkspaceStore((s) => s.commissionDefinitions);
  const setCommissionDefinitions = useWorkspaceStore((s) => s.setCommissionDefinitions);
  const activeCommissionId = useWorkspaceStore((s) => s.activeCommissionId);
  const commissionStatus = useWorkspaceStore((s) => s.commissionStatus);
  const addToast = useWorkspaceStore((s) => s.addToast);
  const startCommission = useWorkspaceStore((s) => s.startCommission);
  const clearCommission = useWorkspaceStore((s) => s.clearCommission);

  useEffect(() => {
    const client = getRpcClient();
    client
      .call("commission.list", {})
      .then(setCommissionDefinitions)
      .catch(() => {});
  }, [setCommissionDefinitions]);

  const isRunning = commissionStatus === "running";

  const handleRun = useCallback(
    async (commissionName: string) => {
      try {
        const client = getRpcClient();
        const { commissionId } = await client.call("commission.run", { commissionName });
        startCommission(commissionId);
        addToast(`Commission started: ${commissionName}`, "info");
      } catch (err) {
        addToast(
          err instanceof Error ? err.message : "Failed to start commission",
          "error"
        );
      }
    },
    [startCommission, addToast]
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
      <div className="flex h-9 shrink-0 items-center px-4 text-[11px] font-semibold uppercase tracking-wider text-[#bbbbbb]">
        <span>Commission</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <CommissionSelector
          definitions={commissionDefinitions}
          onRun={handleRun}
          onAbort={handleAbort}
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
