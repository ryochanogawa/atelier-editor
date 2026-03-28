"use client";

import { useEffect } from "react";
import { getRpcClient } from "@/lib/rpc/client";
import { useWorkspaceStore } from "@/stores/workspace";
import type { FsWatchParams } from "@/lib/rpc/types";

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

    async function initWorkspace(): Promise<void> {
      try {
        const info = await client.call("workspace.info", {} as Record<string, never>);
        useWorkspaceStore.setState({ workspaceInfo: info });

        const tree = await client.call("fs.readTree", {});
        useWorkspaceStore.setState({ tree });
      } catch (err) {
        console.error("Failed to initialize workspace:", err);
      }
    }

    function handleWatchEvent(params: FsWatchParams): void {
      const { path, type } = params;

      if (type === "change") {
        const openFiles = store().openFiles;
        if (openFiles.has(path)) {
          // dirty でなければ最新内容を取得して更新
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

      // ツリーの再取得（create / delete 時）
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
      client.disconnect();
    };
  }, []);
}
