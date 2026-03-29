"use client";

import type { CodeChange } from "@/lib/rpc/types";

interface DiffProposalProps {
  changes: CodeChange[];
  onAccept: (changeId: string) => void;
  onReject: (changeId: string) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
}

function DiffLine({ line, type }: { line: string; type: "add" | "remove" | "context" }) {
  const prefix = type === "add" ? "+" : type === "remove" ? "-" : " ";
  const bg =
    type === "add"
      ? "bg-[#2ea04333]"
      : type === "remove"
        ? "bg-[#f8514933]"
        : "";
  const textColor =
    type === "add"
      ? "text-[#3fb950]"
      : type === "remove"
        ? "text-[#f85149]"
        : "text-[#8b949e]";

  return (
    <div className={`${bg} px-2 font-mono text-[12px] leading-5 ${textColor}`}>
      <span className="mr-2 inline-block w-3 select-none text-right opacity-60">
        {prefix}
      </span>
      {line}
    </div>
  );
}

function computeDiffLines(original: string, modified: string) {
  const origLines = original.split("\n");
  const modLines = modified.split("\n");
  const result: { line: string; type: "add" | "remove" | "context" }[] = [];

  // Simple line-by-line diff (not a full diff algorithm, but sufficient for display)
  const maxLen = Math.max(origLines.length, modLines.length);
  let oi = 0;
  let mi = 0;

  while (oi < origLines.length || mi < modLines.length) {
    if (oi < origLines.length && mi < modLines.length && origLines[oi] === modLines[mi]) {
      result.push({ line: origLines[oi], type: "context" });
      oi++;
      mi++;
    } else {
      // Find next matching line
      let foundOrig = -1;
      let foundMod = -1;
      for (let look = 0; look < 5; look++) {
        if (oi + look < origLines.length && mi < modLines.length && origLines[oi + look] === modLines[mi]) {
          foundOrig = oi + look;
          break;
        }
        if (mi + look < modLines.length && oi < origLines.length && modLines[mi + look] === origLines[oi]) {
          foundMod = mi + look;
          break;
        }
      }
      if (foundOrig >= 0) {
        while (oi < foundOrig) {
          result.push({ line: origLines[oi], type: "remove" });
          oi++;
        }
      } else if (foundMod >= 0) {
        while (mi < foundMod) {
          result.push({ line: modLines[mi], type: "add" });
          mi++;
        }
      } else {
        if (oi < origLines.length) {
          result.push({ line: origLines[oi], type: "remove" });
          oi++;
        }
        if (mi < modLines.length) {
          result.push({ line: modLines[mi], type: "add" });
          mi++;
        }
      }
    }
  }

  return result;
}

function ChangeBlock({
  change,
  onAccept,
  onReject,
}: {
  change: CodeChange;
  onAccept: () => void;
  onReject: () => void;
}) {
  const lines = computeDiffLines(change.original, change.modified);
  const isPending = change.status === "pending";

  return (
    <div className="my-2 overflow-hidden rounded border border-[#3c3c3c]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#3c3c3c] bg-[#252526] px-3 py-1.5">
        <span className="text-[12px] text-[#cccccc]">{change.filePath}</span>
        <div className="flex items-center gap-1">
          {change.status === "accepted" && (
            <span className="text-[11px] text-[#4caf50]">Accepted</span>
          )}
          {change.status === "rejected" && (
            <span className="text-[11px] text-[#f85149]">Rejected</span>
          )}
          {isPending && (
            <>
              <button
                type="button"
                className="rounded bg-[#2ea043] px-2 py-0.5 text-[11px] text-white hover:bg-[#3fb950]"
                onClick={onAccept}
              >
                Accept
              </button>
              <button
                type="button"
                className="rounded bg-[#3c3c3c] px-2 py-0.5 text-[11px] text-[#cccccc] hover:bg-[#4c4c4c]"
                onClick={onReject}
              >
                Reject
              </button>
            </>
          )}
        </div>
      </div>
      {/* Diff content */}
      <div className="max-h-64 overflow-auto bg-[#1e1e1e] py-1">
        {lines.map((l, i) => (
          <DiffLine key={i} line={l.line} type={l.type} />
        ))}
      </div>
    </div>
  );
}

export function DiffProposal({
  changes,
  onAccept,
  onReject,
  onAcceptAll,
  onRejectAll,
}: DiffProposalProps) {
  const hasPending = changes.some((c) => c.status === "pending");

  return (
    <div className="my-2">
      {hasPending && changes.length > 1 && (
        <div className="mb-2 flex gap-2">
          <button
            type="button"
            className="rounded bg-[#2ea043] px-2 py-1 text-[11px] text-white hover:bg-[#3fb950]"
            onClick={onAcceptAll}
          >
            Accept All ({changes.filter((c) => c.status === "pending").length})
          </button>
          <button
            type="button"
            className="rounded bg-[#3c3c3c] px-2 py-1 text-[11px] text-[#cccccc] hover:bg-[#4c4c4c]"
            onClick={onRejectAll}
          >
            Reject All
          </button>
        </div>
      )}
      {changes.map((change) => (
        <ChangeBlock
          key={change.changeId}
          change={change}
          onAccept={() => onAccept(change.changeId)}
          onReject={() => onReject(change.changeId)}
        />
      ))}
    </div>
  );
}
