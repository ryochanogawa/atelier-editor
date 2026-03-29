"use client";

import { useState } from "react";
import type { CommissionDefinition } from "@/lib/rpc/types";

interface CommissionSelectorProps {
  definitions: CommissionDefinition[];
  onRun: (commissionName: string) => void;
  onAbort: () => void;
  isRunning: boolean;
}

export function CommissionSelector({
  definitions,
  onRun,
  onAbort,
  isRunning,
}: CommissionSelectorProps) {
  const [selected, setSelected] = useState("");

  const handleRun = () => {
    if (selected) {
      onRun(selected);
    }
  };

  return (
    <div className="border-b border-[#3c3c3c] px-3 py-2">
      <select
        className="mb-2 w-full rounded bg-[#3c3c3c] px-2 py-1.5 text-[12px] text-[#cccccc] outline-none focus:ring-1 focus:ring-[#007acc]"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        disabled={isRunning}
      >
        <option value="">Select a commission...</option>
        {definitions.map((def) => (
          <option key={def.name} value={def.name}>
            {def.name}
          </option>
        ))}
      </select>

      {selected && !isRunning && (
        <p className="mb-2 text-[11px] text-[#969696]">
          {definitions.find((d) => d.name === selected)?.description}
        </p>
      )}

      {isRunning ? (
        <button
          type="button"
          className="w-full rounded bg-[#c74e39] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[#d45a45]"
          onClick={onAbort}
        >
          Abort
        </button>
      ) : (
        <button
          type="button"
          className="w-full rounded bg-[#007acc] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[#0098ff] disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={handleRun}
          disabled={!selected}
        >
          Run Commission
        </button>
      )}
    </div>
  );
}
