"use client";

import { useWorkspaceStore } from "@/stores/workspace";

const STATUS_ICON: Record<string, { label: string; color: string }> = {
  running: { label: "●", color: "text-[#007acc]" },
  completed: { label: "✓", color: "text-[#73c991]" },
  failed: { label: "✗", color: "text-[#c74e39]" },
};

export function CommissionStrokeList() {
  const strokes = useWorkspaceStore((s) => s.commissionStrokes);

  if (strokes.length === 0) return null;

  return (
    <div className="border-b border-[#3c3c3c] px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[#bbbbbb]">
        Strokes
      </div>
      <div className="mt-1 space-y-0.5">
        {strokes.map((stroke) => {
          const icon = STATUS_ICON[stroke.status] ?? STATUS_ICON.running;
          return (
            <div
              key={stroke.strokeId}
              className="flex items-center gap-2 rounded px-2 py-0.5 text-[12px] text-[#cccccc]"
            >
              <span className={`text-[10px] ${icon.color}`}>{icon.label}</span>
              <span className="truncate">{stroke.strokeName}</span>
              {stroke.status === "running" && (
                <span className="ml-auto text-[10px] text-[#969696] animate-pulse">
                  running
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
