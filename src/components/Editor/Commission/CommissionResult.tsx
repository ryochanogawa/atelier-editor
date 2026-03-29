"use client";

import { useCallback } from "react";
import { useWorkspaceStore } from "@/stores/workspace";
import { getRpcClient } from "@/lib/rpc/client";

export function CommissionResult() {
  const result = useWorkspaceStore((s) => s.commissionResult);
  const setDiffFile = useWorkspaceStore((s) => s.setDiffFile);

  const handleFileClick = useCallback(
    async (filePath: string) => {
      try {
        const client = getRpcClient();
        const diff = await client.call("git.diff", { path: filePath });
        setDiffFile(diff);
      } catch {
        // silent
      }
    },
    [setDiffFile]
  );

  if (!result) return null;

  const isSuccess = result.status === "success";
  const isAborted = result.status === "aborted";

  return (
    <div className="border-t border-[#3c3c3c] px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[#bbbbbb]">
        Result
      </div>

      <div
        className={`mt-1 rounded px-2 py-1.5 text-[12px] ${
          isSuccess
            ? "bg-[#1e3a1e] text-[#73c991]"
            : isAborted
              ? "bg-[#3a3a1e] text-[#e2c08d]"
              : "bg-[#3a1e1e] text-[#c74e39]"
        }`}
      >
        {isSuccess
          ? "Commission completed successfully"
          : isAborted
            ? "Commission was aborted"
            : `Commission failed: ${result.error ?? "Unknown error"}`}
      </div>

      {result.summary && (
        <p className="mt-2 text-[12px] text-[#cccccc]">{result.summary}</p>
      )}

      {result.changedFiles && result.changedFiles.length > 0 && (
        <div className="mt-2">
          <div className="text-[11px] text-[#969696]">
            Changed files ({result.changedFiles.length})
          </div>
          <div className="mt-1 space-y-0.5">
            {result.changedFiles.map((file) => (
              <button
                key={file}
                type="button"
                className="block w-full truncate rounded px-2 py-0.5 text-left text-[12px] text-[#cccccc] hover:bg-[#2a2d2e]"
                onClick={() => handleFileClick(file)}
                title={file}
              >
                {file}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
