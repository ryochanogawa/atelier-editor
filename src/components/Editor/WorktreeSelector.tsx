"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useWorkspaceStore } from "@/stores/workspace";
import { getRpcClient } from "@/lib/rpc/client";

export function WorktreeSelector() {
  const worktrees = useWorkspaceStore((s) => s.worktrees);
  const activeWorktreeId = useWorkspaceStore((s) => s.activeWorktreeId);
  const currentBranch = useWorkspaceStore((s) => s.currentBranch);
  const addToast = useWorkspaceStore((s) => s.addToast);

  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newBranch, setNewBranch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSwitch = useCallback(
    async (worktreeId: string) => {
      if (worktreeId === activeWorktreeId) {
        setOpen(false);
        return;
      }
      try {
        const client = getRpcClient();
        await client.call("studio.switch", { worktreeId });
        useWorkspaceStore.getState().setActiveWorktreeId(worktreeId);
        setOpen(false);
        addToast(`Switched to worktree: ${worktreeId}`, "info");
      } catch (err) {
        addToast(
          err instanceof Error ? err.message : "Switch failed",
          "error"
        );
      }
    },
    [activeWorktreeId, addToast]
  );

  const handleCreate = useCallback(async () => {
    const branch = newBranch.trim();
    if (!branch) return;
    try {
      const client = getRpcClient();
      await client.call("studio.create", { branch });
      setNewBranch("");
      setCreating(false);
      addToast(`Created worktree: ${branch}`, "success");
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : "Create failed",
        "error"
      );
    }
  }, [newBranch, addToast]);

  const handleRemove = useCallback(
    async (worktreeId: string) => {
      try {
        const client = getRpcClient();
        await client.call("studio.remove", { worktreeId });
        addToast(`Removed worktree: ${worktreeId}`, "success");
      } catch (err) {
        addToast(
          err instanceof Error ? err.message : "Remove failed",
          "error"
        );
      }
    },
    [addToast]
  );

  const activeWorktree = worktrees.find((w) => w.id === activeWorktreeId);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        className="flex items-center gap-1.5 rounded px-2 py-0.5 text-[12px] text-[#cccccc] hover:bg-[#3c3c3c]"
        onClick={() => setOpen(!open)}
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
          <path d="M21.007 8.222A3.738 3.738 0 0 0 15.045 5.2a3.737 3.737 0 0 0 1.156 6.583 2.988 2.988 0 0 1-2.668 1.67h-2.99a4.456 4.456 0 0 0-2.989 1.165V7.4a3.737 3.737 0 1 0-1.494 0v9.117a3.776 3.776 0 1 0 1.816.099 2.99 2.99 0 0 1 2.668-1.667h2.99a4.484 4.484 0 0 0 4.223-3.039 3.736 3.736 0 0 0 3.25-3.687zM4.565 3.738a2.242 2.242 0 1 1 4.484 0 2.242 2.242 0 0 1-4.484 0zm4.484 16.441a2.242 2.242 0 1 1-4.484 0 2.242 2.242 0 0 1 4.484 0zm8.221-9.715a2.242 2.242 0 1 1 0-4.485 2.242 2.242 0 0 1 0 4.485z" />
        </svg>
        <span>{activeWorktree?.branch ?? currentBranch?.name ?? "—"}</span>
        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor">
          <path d="M8 10.5L3.5 6h9L8 10.5z" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded border border-[#3c3c3c] bg-[#252526] py-1 shadow-lg">
          <div className="px-2 py-1 text-[10px] font-semibold uppercase text-[#858585]">
            Worktrees
          </div>
          {worktrees.map((wt) => (
            <div
              key={wt.id}
              className="group flex items-center justify-between px-2 py-1 hover:bg-[#2a2d2e]"
            >
              <button
                type="button"
                className={`flex-1 text-left text-[12px] ${
                  wt.id === activeWorktreeId
                    ? "text-[#007acc]"
                    : "text-[#cccccc]"
                }`}
                onClick={() => handleSwitch(wt.id)}
              >
                {wt.branch}
                {wt.isMain && (
                  <span className="ml-1 text-[10px] text-[#858585]">main</span>
                )}
              </button>
              {!wt.isMain && (
                <button
                  type="button"
                  className="shrink-0 px-1 text-[11px] text-[#858585] opacity-0 hover:text-[#c74e39] group-hover:opacity-100"
                  onClick={() => handleRemove(wt.id)}
                  title="Remove worktree"
                >
                  ×
                </button>
              )}
            </div>
          ))}

          <div className="border-t border-[#3c3c3c] mt-1 pt-1">
            {creating ? (
              <div className="flex gap-1 px-2 py-1">
                <input
                  type="text"
                  className="flex-1 rounded border border-[#3c3c3c] bg-[#3c3c3c] px-1.5 py-0.5 text-[12px] text-[#cccccc] placeholder-[#858585] focus:border-[#007acc] focus:outline-none"
                  placeholder="Branch name"
                  value={newBranch}
                  onChange={(e) => setNewBranch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                    if (e.key === "Escape") {
                      setCreating(false);
                      setNewBranch("");
                    }
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  className="rounded bg-[#007acc] px-2 text-[11px] text-white hover:bg-[#0062a3]"
                  onClick={handleCreate}
                >
                  OK
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="w-full px-2 py-1 text-left text-[12px] text-[#cccccc] hover:bg-[#2a2d2e]"
                onClick={() => setCreating(true)}
              >
                + New Worktree
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
