"use client";

import { useState } from "react";
import { getRpcClient } from "@/lib/rpc/client";
import { useWorkspaceStore } from "@/stores/workspace";
import type { EnvironmentStatus } from "@/lib/environment/types";

interface EnvironmentActionsProps {
  worktreeId: string;
  status: EnvironmentStatus;
}

export function EnvironmentActions({ worktreeId, status }: EnvironmentActionsProps) {
  const [loading, setLoading] = useState(false);
  const addToast = useWorkspaceStore((s) => s.addToast);

  const isTransitioning = status === "building" || status === "setup";
  const disabled = loading || isTransitioning;

  async function handleAction(action: "start" | "stop" | "restart" | "remove") {
    setLoading(true);
    try {
      const client = getRpcClient();
      if (action === "start") {
        await client.call("environment.start", { worktreeId });
      } else if (action === "stop") {
        await client.call("environment.stop", { worktreeId });
      } else if (action === "restart") {
        await client.call("environment.restart", { worktreeId });
      } else if (action === "remove") {
        await client.call("environment.remove", { worktreeId });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      addToast(`操作失敗: ${message}`, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-1">
      {(status === "idle" || status === "stopped" || status === "error") && (
        <ActionButton
          label={status === "error" ? "Retry" : "Start"}
          onClick={() => handleAction("start")}
          disabled={disabled}
          variant="primary"
        />
      )}
      {status === "running" && (
        <>
          <ActionButton
            label="Stop"
            onClick={() => handleAction("stop")}
            disabled={disabled}
            variant="default"
          />
          <ActionButton
            label="Restart"
            onClick={() => handleAction("restart")}
            disabled={disabled}
            variant="default"
          />
        </>
      )}
      {(status === "stopped" || status === "error" || status === "idle") && (
        <ActionButton
          label="Remove"
          onClick={() => handleAction("remove")}
          disabled={disabled || status === "idle"}
          variant="danger"
        />
      )}
      {isTransitioning && (
        <span className="flex items-center text-[10px] text-yellow-400">
          <svg className="mr-1 h-3 w-3 animate-spin" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="24 12" />
          </svg>
          {status === "building" ? "Building..." : "Setting up..."}
        </span>
      )}
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  disabled,
  variant,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  variant: "primary" | "default" | "danger";
}) {
  const colors = {
    primary: "bg-[#0e639c] hover:bg-[#1177bb] text-white",
    default: "bg-[#3c3c3c] hover:bg-[#505050] text-[#ccc]",
    danger: "bg-[#5a1d1d] hover:bg-[#6e2424] text-red-300",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded px-2 py-0.5 text-[11px] transition-colors disabled:opacity-40 ${colors[variant]}`}
    >
      {label}
    </button>
  );
}
