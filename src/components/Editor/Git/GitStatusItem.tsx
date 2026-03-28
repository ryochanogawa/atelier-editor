"use client";

import { useCallback } from "react";
import type { GitStatusEntry, GitFileStatus } from "@/lib/rpc/types";
import { getRpcClient } from "@/lib/rpc/client";
import { useWorkspaceStore } from "@/stores/workspace";

interface GitStatusItemProps {
  entry: GitStatusEntry;
}

const STATUS_ICONS: Record<GitFileStatus, { label: string; color: string }> = {
  modified: { label: "M", color: "text-[#e2c08d]" },
  added: { label: "A", color: "text-[#73c991]" },
  deleted: { label: "D", color: "text-[#c74e39]" },
  renamed: { label: "R", color: "text-[#73c991]" },
  untracked: { label: "U", color: "text-[#73c991]" },
};

export function GitStatusItem({ entry }: GitStatusItemProps) {
  const setDiffFile = useWorkspaceStore((s) => s.setDiffFile);
  const addToast = useWorkspaceStore((s) => s.addToast);

  const fileName = entry.path.split("/").pop() ?? entry.path;
  const dirPath = entry.path.includes("/")
    ? entry.path.slice(0, entry.path.lastIndexOf("/"))
    : "";

  const { label, color } = STATUS_ICONS[entry.status];

  const handleToggleStage = useCallback(async () => {
    try {
      const client = getRpcClient();
      if (entry.staged) {
        await client.call("git.unstage", { paths: [entry.path] });
      } else {
        await client.call("git.stage", { paths: [entry.path] });
      }
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : "Stage/unstage failed",
        "error"
      );
    }
  }, [entry.staged, entry.path, addToast]);

  const handleShowDiff = useCallback(async () => {
    try {
      const client = getRpcClient();
      const diff = await client.call("git.diff", { path: entry.path });
      setDiffFile(diff);
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : "Failed to load diff",
        "error"
      );
    }
  }, [entry.path, setDiffFile, addToast]);

  return (
    <li className="group flex items-center gap-1 px-4 py-0.5 hover:bg-[#2a2d2e] cursor-pointer">
      <button
        type="button"
        className="flex flex-1 items-center gap-1.5 overflow-hidden text-left"
        onClick={handleShowDiff}
      >
        <span className={`shrink-0 w-4 text-center font-mono text-[11px] ${color}`}>
          {label}
        </span>
        <span className="truncate text-[#cccccc]">{fileName}</span>
        {dirPath && (
          <span className="truncate text-[#858585]">{dirPath}</span>
        )}
      </button>
      <button
        type="button"
        className="shrink-0 rounded px-1 text-[11px] text-[#858585] opacity-0 hover:bg-[#3c3c3c] hover:text-white group-hover:opacity-100"
        onClick={handleToggleStage}
        title={entry.staged ? "Unstage" : "Stage"}
      >
        {entry.staged ? "−" : "+"}
      </button>
    </li>
  );
}
