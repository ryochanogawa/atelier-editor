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
  PreviewStatusChangeParams,
  PreviewLogParams,
  ChatStreamParams,
  ChatCodeChangeParams,
  EnvironmentStatusChangeParams,
  EnvironmentBuildLogParams,
  EnvironmentConfigChangedParams,
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

    const unsubPreviewStatus = client.onNotification("preview.statusChange", (params: PreviewStatusChangeParams) => {
      store().setDevServerStatus(params.status);
      store().setPreviewUrl(params.url, params.port);
      if (params.error) {
        store().setPreviewError(params.error);
      }
    });

    const unsubPreviewLog = client.onNotification("preview.log", (params: PreviewLogParams) => {
      store().addPreviewLog(params.line);
    });

    const unsubChatStream = client.onNotification("chat.stream", (params: ChatStreamParams) => {
      const { chatId } = store();
      if (params.chatId !== chatId) return;

      if (params.done) {
        store().finalizeStream(params.messageId);
      } else {
        store().appendStreamDelta(params.messageId, params.delta);
      }
    });

    const unsubChatCodeChange = client.onNotification("chat.codeChange", (params: ChatCodeChangeParams) => {
      const { chatId } = store();
      if (params.chatId !== chatId) return;

      store().addCodeChange(params.messageId, {
        changeId: params.changeId,
        filePath: params.filePath,
        original: params.original,
        modified: params.modified,
        status: "pending",
      });
    });

    const unsubEnvStatusChange = client.onNotification("environment.statusChange", (params: EnvironmentStatusChangeParams) => {
      store().setEnvironmentStatus(params.worktreeId, params.status, {
        hostPort: params.hostPort,
        containerId: params.containerId,
        error: params.error,
      });

      // コンテナが running になったらプレビューURLを自動設定
      if (params.status === "running" && params.hostPort) {
        const { activeWorktreeId } = store();
        if (params.worktreeId === activeWorktreeId) {
          const url = `http://localhost:${params.hostPort}`;
          store().setPreviewUrl(url, params.hostPort, "container");
          store().setDevServerStatus("running");
          store().setPreviewVisible(true);
        }
      }

      // コンテナが stopped/error になったらコンテナプレビューをクリア
      if ((params.status === "stopped" || params.status === "error") && store().previewSource === "container") {
        const { activeWorktreeId } = store();
        if (params.worktreeId === activeWorktreeId) {
          store().setPreviewUrl(null, null, "container");
          store().setDevServerStatus("stopped");
        }
      }
    });

    const unsubEnvBuildLog = client.onNotification("environment.buildLog", (params: EnvironmentBuildLogParams) => {
      store().appendBuildLog(params.worktreeId, params.data);
    });

    const unsubEnvConfigChanged = client.onNotification("environment.configChanged", (params: EnvironmentConfigChangedParams) => {
      store().setEnvironmentConfig(params.worktreeId, params.config);
      store().addToast("environment.yml が更新されました", "info");
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

        // Commission一覧の初期取得はCommissionPanelに委譲（二重フェッチ防止）

        // 環境設定の初期読み込み（environment.yml が存在する場合のみ）
        try {
          const envConfig = await client.call("environment.read", {});
          const activeId = mainWorktree?.id ?? "main";
          store().setEnvironmentConfig(activeId, envConfig);
        } catch {
          // environment.yml が存在しない場合は無視
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
      unsubPreviewStatus();
      unsubPreviewLog();
      unsubChatStream();
      unsubChatCodeChange();
      unsubEnvStatusChange();
      unsubEnvBuildLog();
      unsubEnvConfigChanged();
      client.disconnect();
    };
  }, []);
}
