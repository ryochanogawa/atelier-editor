"use client";

import { useState, useEffect } from "react";
import type { CommissionDefinition } from "@/lib/rpc/types";

interface CommissionSelectorProps {
  definitions: CommissionDefinition[];
  loading: boolean;
  error: string | null;
  onRun: (commissionName: string) => void;
  onAbort: () => void;
  onRetry: () => void;
  isRunning: boolean;
}

export function CommissionSelector({
  definitions,
  loading,
  error,
  onRun,
  onAbort,
  onRetry,
  isRunning,
}: CommissionSelectorProps) {
  const [selected, setSelected] = useState("");

  // definitions が変わったら、選択中のcommissionが存在しなければリセット
  useEffect(() => {
    if (selected && !definitions.some((d) => d.name === selected)) {
      setSelected("");
    }
  }, [definitions, selected]);

  const selectedDef = definitions.find((d) => d.name === selected);

  const handleRun = () => {
    if (selected) {
      onRun(selected);
    }
  };

  if (loading) {
    return (
      <div className="border-b border-[#3c3c3c] px-3 py-4">
        <div className="flex items-center gap-2 text-[12px] text-[#969696]">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="8" />
          </svg>
          Loading commissions...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border-b border-[#3c3c3c] px-3 py-3">
        <p className="mb-2 text-[12px] text-[#f48771]">{error}</p>
        <button
          type="button"
          className="rounded bg-[#3c3c3c] px-3 py-1 text-[12px] text-[#cccccc] hover:bg-[#4c4c4c]"
          onClick={onRetry}
        >
          Retry
        </button>
      </div>
    );
  }

  if (definitions.length === 0 && !isRunning) {
    return (
      <div className="border-b border-[#3c3c3c] px-3 py-4">
        <p className="text-[12px] text-[#969696]">No commissions available</p>
      </div>
    );
  }

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

      {selectedDef && !isRunning && (
        <div className="mb-2">
          <p className="text-[11px] text-[#969696]">{selectedDef.description}</p>
          {selectedDef.params && Object.keys(selectedDef.params).length > 0 && (
            <div className="mt-1.5 rounded bg-[#1e1e1e] px-2 py-1.5">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#808080]">
                Parameters
              </p>
              {Object.entries(selectedDef.params).map(([key, schema]) => (
                <div key={key} className="flex items-baseline gap-1.5 text-[11px]">
                  <span className="text-[#9cdcfe]">{key}</span>
                  <span className="text-[#808080]">{schema.type}</span>
                  {schema.required && (
                    <span className="text-[#f48771]">*</span>
                  )}
                  {schema.description && (
                    <span className="text-[#6a9955]">— {schema.description}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
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
          className="w-full rounded bg-[#007acc] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[#0098ff] disabled:cursor-not-allowed disabled:opacity-40"
          onClick={handleRun}
          disabled={!selected}
        >
          Run Commission
        </button>
      )}
    </div>
  );
}
