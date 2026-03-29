"use client";

import { useEffect } from "react";
import { getRpcClient } from "@/lib/rpc/client";
import { useWorkspaceStore } from "@/stores/workspace";
import type {
  FsWatchParams,
  GitChangeParams,
  StudioChangeParams,
  CommissionProgressParams,
  CommissionStrokeParams,
  CommissionCompletedParams,
} from "@/lib/rpc/types";

export function useConnection(): void {
  useEffect(() => {
    const client = getRpcClient();
    const store = useWorkspaceStore.getState;

    const unsubStatus = client.onStatusChange((status) => {
      useWorkspaceStore.setState({ status });

      if (status === "connected") {
        initWorkspace();
      }
    });

    const unsubWatch = client.onNotification("fs.watch", (params: FsWatchParams) => {
      handleWatchEvent(params);
    });

    const unsubGitChanged = client.onNotification("git.changed", (_params: GitChangeParams) => {
      Promise.all([
        client.call("git.status", {}),
        client.call("git.branches", {}),
      ]).then(([status, branches]) => {
        store().setGitStatus(status);
        store().setBranches(branches);
      }).catch(() => {
        // サイレントに失敗
      });
    });

    const unsubStudioChanged = client.onNotification("studio.changed", (_params: StudioChangeParams) => {
      client.call("studio.list", {}).then((worktrees) => {
        store().setWorktrees(worktrees);
      }).catch(() => {
        // サイレントに失敗
      });
    });

    const unsubCommissionProgress = client.onNotification("commission.progress", (params: CommissionProgressParams) => {
      const { activeCommissionId } = store();
      if (activeCommissionId && params.commissionId === activeCommissionId) {
        store().addCommissionLog({
          phase: params.phase,
          message: params.message,
          progress: params.progress,
          timestamp: params.timestamp,
        });
      }
    });

    const unsubCommissionStroke = client.onNotification("commission.stroke", (params: CommissionStrokeParams) => {
      const { activeCommissionId } = store();
      if (activeCommissionId && params.commissionId === activeCommissionId) {
        store().updateCommissionStroke({
          strokeId: params.strokeId,
          strokeName: params.strokeName,
          status: params.status,
        });
      }
    });

    const unsubCommissionCompleted = client.onNotification("commission.completed", (params: CommissionCompletedParams) => {
      const { activeCommissionId } = store();
      if (activeCommissionId && params.commissionId === activeCommissionId) {
        store().completeCommission({
          status: params.status,
          changedFiles: params.result?.changedFiles,
          summary: params.result?.summary,
          error: params.error,
        });
      }
    });

    async function initWorkspace(): Promise<void> {
      try {
        const [info, tree, gitStatus, branches, worktrees] = await Promise.all([
          client.call("workspace.info", {} as Record<string, never>),
          client.call("fs.readTree", {}),
          client.call("git.status", {}),
          client.call("git.branches", {}),
          client.call("studio.list", {}),
        ]);
        useWorkspaceStore.setState({ workspaceInfo: info, tree });
        store().setGitStatus(gitStatus);
        store().setBranches(branches);
        store().setWorktrees(worktrees);

        // activeWorktreeId を isMain=true のものに設定
        const mainWorktree = worktrees.find((w) => w.isMain);
        if (mainWorktree) {
          store().setActiveWorktreeId(mainWorktree.id);
        }
      } catch (err) {
        console.error("Failed to initialize workspace:", err);
      }
    }

    function handleWatchEvent(params: FsWatchParams): void {
      const { path, type } = params;

      if (type === "change") {
        const openFiles = store().openFiles;
        if (openFiles.has(path)) {
          const file = openFiles.get(path)!;
          if (file.content === file.originalContent) {
            client
              .call("fs.readFile", { path })
              .then((result) => {
                store().reloadFile(path, result.content);
              })
              .catch(() => {
                // サイレントに失敗
              });
          }
        }
      }

      if (type === "create" || type === "delete") {
        client
          .call("fs.readTree", {})
          .then((tree) => {
            useWorkspaceStore.setState({ tree });
          })
          .catch(() => {
            // サイレントに失敗
          });
      }
    }

    client.connect();

    return () => {
      unsubStatus();
      unsubWatch();
      unsubGitChanged();
      unsubStudioChanged();
      unsubCommissionProgress();
      unsubCommissionStroke();
      unsubCommissionCompleted();
      client.disconnect();
    };
  }, []);
}
