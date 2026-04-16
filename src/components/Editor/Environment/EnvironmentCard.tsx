"use client";

import type { EnvironmentState } from "@/lib/environment/types";
import { EnvironmentActions } from "./EnvironmentActions";
import { EnvironmentError } from "./EnvironmentError";

interface EnvironmentCardProps {
  env: EnvironmentState;
  onViewLogs: (worktreeId: string) => void;
}

const STATUS_STYLES: Record<string, { color: string; label: string; pulse?: boolean }> = {
  idle: { color: "bg-[#666]", label: "Idle" },
  building: { color: "bg-yellow-500", label: "Building", pulse: true },
  setup: { color: "bg-yellow-500", label: "Setup", pulse: true },
  running: { color: "bg-green-500", label: "Running" },
  stopped: { color: "bg-[#666]", label: "Stopped" },
  error: { color: "bg-red-500", label: "Error" },
};

export function EnvironmentCard({ env, onViewLogs }: EnvironmentCardProps) {
  const statusStyle = STATUS_STYLES[env.status] ?? STATUS_STYLES.idle;

  return (
    <div className="rounded border border-[#3c3c3c] bg-[#252526] p-3">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2 w-2 rounded-full ${statusStyle.color} ${
              statusStyle.pulse ? "animate-pulse" : ""
            }`}
          />
          <span className="text-sm font-medium text-[#e0e0e0]">
            {env.branch}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {env.hostPort && (
            <span className="rounded bg-[#1e1e1e] px-1.5 py-0.5 font-mono text-[10px] text-[#4ec9b0]">
              :{env.hostPort}
            </span>
          )}
          <span className="text-[10px] text-[#888]">{statusStyle.label}</span>
        </div>
      </div>

      {/* Config info */}
      {env.config && (
        <div className="mb-2 space-y-0.5 text-[11px] text-[#888]">
          <div>
            <span className="text-[#666]">base:</span>{" "}
            <span className="text-[#ccc]">{env.config.base}</span>
          </div>
          {env.config.compose && (
            <div>
              <span className="text-[#666]">compose:</span>{" "}
              <span className="text-[#ccc]">{env.config.compose}</span>
            </div>
          )}
          <div>
            <span className="text-[#666]">dev:</span>{" "}
            <span className="font-mono text-[#ccc]">{env.config.dev.command}</span>
          </div>
        </div>
      )}

      {/* Service states */}
      {Object.keys(env.serviceStates).length > 0 && (
        <div className="mb-2 space-y-0.5">
          {Object.values(env.serviceStates).map((svc) => {
            const svcStatus = STATUS_STYLES[svc.status] ?? STATUS_STYLES.stopped;
            return (
              <div key={svc.name} className="flex items-center gap-1.5 text-[10px] text-[#999]">
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${svcStatus.color}`} />
                <span>{svc.name}</span>
                {svc.hostPort && (
                  <span className="font-mono text-[#4ec9b0]">:{svc.hostPort}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Error */}
      {env.error && env.status === "error" && (
        <div className="mb-2">
          <EnvironmentError error={env.error} />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <EnvironmentActions worktreeId={env.worktreeId} status={env.status} />
        <button
          type="button"
          onClick={() => onViewLogs(env.worktreeId)}
          className="text-[10px] text-[#0e639c] hover:text-[#1177bb] hover:underline"
        >
          Logs
        </button>
      </div>
    </div>
  );
}
