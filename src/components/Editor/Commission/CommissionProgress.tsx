"use client";

import { useRef, useEffect } from "react";
import { useWorkspaceStore } from "@/stores/workspace";

export function CommissionProgress() {
  const logs = useWorkspaceStore((s) => s.commissionLogs);
  const progress = useWorkspaceStore((s) => s.commissionProgress);
  const commissionStatus = useWorkspaceStore((s) => s.commissionStatus);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

  return (
    <div className="border-b border-[#3c3c3c]">
      {/* Progress bar */}
      {progress !== null && commissionStatus === "running" && (
        <div className="px-3 pt-2">
          <div className="flex items-center justify-between text-[11px] text-[#969696]">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#3c3c3c]">
            <div
              className="h-full rounded-full bg-[#007acc] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Log area */}
      <div className="px-3 py-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[#bbbbbb]">
          Log
        </div>
        <div className="mt-1 max-h-48 overflow-y-auto rounded bg-[#1e1e1e] p-2 font-mono text-[11px] leading-relaxed text-[#cccccc]">
          {logs.length === 0 ? (
            <span className="text-[#666666]">Waiting for output...</span>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="flex gap-2">
                <span className="shrink-0 text-[#666666]">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span className="text-[#569cd6]">[{log.phase}]</span>
                <span>{log.message}</span>
              </div>
            ))
          )}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
}
