"use client";

import { useCallback, useEffect } from "react";
import { useWorkspaceStore } from "@/stores/workspace";
import { getRpcClient } from "@/lib/rpc/client";
import { GitStatusList } from "./GitStatusList";
import { CommitForm } from "./CommitForm";
import { CommitLog } from "./CommitLog";

export function GitPanel() {
  const gitStatus = useWorkspaceStore((s) => s.gitStatus);
  const currentBranch = useWorkspaceStore((s) => s.currentBranch);
  const commitLog = useWorkspaceStore((s) => s.commitLog);
  const setCommitLog = useWorkspaceStore((s) => s.setCommitLog);
  const addToast = useWorkspaceStore((s) => s.addToast);

  useEffect(() => {
    const client = getRpcClient();
    client
      .call("git.log", { limit: 50 })
      .then(setCommitLog)
      .catch(() => {});
  }, [setCommitLog]);

  const handleCommit = useCallback(
    async (message: string) => {
      try {
        const client = getRpcClient();
        const result = await client.call("git.commit", { message });
        addToast(`Committed: ${result.hash}`, "success");
        // Refresh log
        const log = await client.call("git.log", { limit: 50 });
        setCommitLog(log);
      } catch (err) {
        addToast(
          err instanceof Error ? err.message : "Commit failed",
          "error"
        );
      }
    },
    [setCommitLog, addToast]
  );

  const handlePush = useCallback(async () => {
    try {
      const client = getRpcClient();
      await client.call("git.push", {});
      addToast("Pushed successfully", "success");
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : "Push failed",
        "error"
      );
    }
  }, [addToast]);

  const stagedCount = gitStatus.filter((e) => e.staged).length;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#252526]">
      <div className="flex h-9 shrink-0 items-center justify-between px-4 text-[11px] font-semibold uppercase tracking-wider text-[#bbbbbb]">
        <span>Source Control</span>
        {currentBranch && (
          <span className="normal-case tracking-normal font-normal text-[#969696]">
            {currentBranch.name}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <GitStatusList entries={gitStatus} />

        <CommitForm
          onCommit={handleCommit}
          disabled={stagedCount === 0}
        />

        <div className="border-t border-[#3c3c3c] px-3 py-2">
          <button
            type="button"
            className="w-full rounded bg-[#3c3c3c] px-3 py-1 text-[12px] text-[#cccccc] hover:bg-[#4c4c4c] disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={handlePush}
            disabled={!currentBranch?.remote}
            title={currentBranch?.remote ? "Push to remote" : "No remote configured"}
          >
            Push{currentBranch?.ahead ? ` ↑${currentBranch.ahead}` : ""}
          </button>
        </div>

        <CommitLog entries={commitLog} />
      </div>
    </div>
  );
}
