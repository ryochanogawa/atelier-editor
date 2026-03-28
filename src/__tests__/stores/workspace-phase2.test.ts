import { describe, it, expect, vi, afterEach } from "vitest";
import { useWorkspaceStore } from "@/stores/workspace";
import type { GitStatusEntry, GitBranch, GitLogEntry, GitDiffFile, WorktreeInfo } from "@/lib/rpc/types";

function getState() {
  return useWorkspaceStore.getState();
}

describe("workspace store – Phase 2 slices", () => {
  // ── Git Slice ──

  describe("GitSlice", () => {
    const mockStatus: GitStatusEntry[] = [
      { path: "src/index.ts", status: "modified", staged: true },
      { path: "src/app.ts", status: "added", staged: false },
    ];

    const mockBranches: GitBranch[] = [
      { name: "main", current: true, remote: "origin/main", ahead: 2, behind: 0 },
      { name: "feature", current: false },
    ];

    const mockLog: GitLogEntry[] = [
      { hash: "abc1234", message: "initial commit", author: "dev", date: "2026-03-28T10:00:00Z" },
      { hash: "def5678", message: "add feature", author: "dev", date: "2026-03-28T11:00:00Z" },
    ];

    const mockDiff: GitDiffFile = {
      path: "src/index.ts",
      original: "const a = 1;",
      modified: "const a = 2;",
    };

    it("initial git state is empty", () => {
      expect(getState().gitStatus).toEqual([]);
      expect(getState().branches).toEqual([]);
      expect(getState().currentBranch).toBeNull();
      expect(getState().commitLog).toEqual([]);
      expect(getState().diffFile).toBeNull();
    });

    it("setGitStatus updates entries", () => {
      getState().setGitStatus(mockStatus);
      expect(getState().gitStatus).toEqual(mockStatus);
    });

    it("setBranches updates branches and derives currentBranch", () => {
      getState().setBranches(mockBranches);
      expect(getState().branches).toEqual(mockBranches);
      expect(getState().currentBranch).toEqual(mockBranches[0]);
    });

    it("setBranches sets currentBranch to null when no branch is current", () => {
      const noCurrent: GitBranch[] = [
        { name: "main", current: false },
        { name: "feature", current: false },
      ];
      getState().setBranches(noCurrent);
      expect(getState().currentBranch).toBeNull();
    });

    it("setCommitLog updates log entries", () => {
      getState().setCommitLog(mockLog);
      expect(getState().commitLog).toEqual(mockLog);
    });

    it("setDiffFile sets diff", () => {
      getState().setDiffFile(mockDiff);
      expect(getState().diffFile).toEqual(mockDiff);
    });

    it("setDiffFile clears diff with null", () => {
      getState().setDiffFile(mockDiff);
      getState().setDiffFile(null);
      expect(getState().diffFile).toBeNull();
    });

    it("clearGitState resets all git fields", () => {
      getState().setGitStatus(mockStatus);
      getState().setBranches(mockBranches);
      getState().setCommitLog(mockLog);
      getState().setDiffFile(mockDiff);

      getState().clearGitState();

      expect(getState().gitStatus).toEqual([]);
      expect(getState().branches).toEqual([]);
      expect(getState().currentBranch).toBeNull();
      expect(getState().commitLog).toEqual([]);
      expect(getState().diffFile).toBeNull();
    });
  });

  // ── Studio Slice ──

  describe("StudioSlice", () => {
    const mockWorktrees: WorktreeInfo[] = [
      { id: "wt-main", path: "/repo", branch: "main", isMain: true },
      { id: "wt-feat", path: "/repo-feat", branch: "feature", isMain: false },
    ];

    it("initial studio state is empty", () => {
      expect(getState().worktrees).toEqual([]);
      expect(getState().activeWorktreeId).toBeNull();
    });

    it("setWorktrees updates worktree list", () => {
      getState().setWorktrees(mockWorktrees);
      expect(getState().worktrees).toEqual(mockWorktrees);
    });

    it("setActiveWorktreeId updates active worktree", () => {
      getState().setActiveWorktreeId("wt-feat");
      expect(getState().activeWorktreeId).toBe("wt-feat");
    });

    it("clearStudioState resets all studio fields", () => {
      getState().setWorktrees(mockWorktrees);
      getState().setActiveWorktreeId("wt-main");

      getState().clearStudioState();

      expect(getState().worktrees).toEqual([]);
      expect(getState().activeWorktreeId).toBeNull();
    });
  });

  // ── Sidebar Slice ──

  describe("SidebarSlice", () => {
    it("initial sidebarView is files", () => {
      expect(getState().sidebarView).toBe("files");
    });

    it("setSidebarView changes view to git", () => {
      getState().setSidebarView("git");
      expect(getState().sidebarView).toBe("git");
    });

    it("setSidebarView changes view back to files", () => {
      getState().setSidebarView("git");
      getState().setSidebarView("files");
      expect(getState().sidebarView).toBe("files");
    });
  });

  // ── Toast Slice ──

  describe("ToastSlice", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("initial toasts is empty", () => {
      expect(getState().toasts).toEqual([]);
    });

    it("addToast adds a toast with correct type and message", () => {
      vi.spyOn(crypto, "randomUUID").mockReturnValue("test-id-1" as `${string}-${string}-${string}-${string}-${string}`);
      getState().addToast("Hello", "info");

      expect(getState().toasts).toHaveLength(1);
      expect(getState().toasts[0]).toEqual({
        id: "test-id-1",
        message: "Hello",
        type: "info",
      });
    });

    it("addToast supports error type", () => {
      getState().addToast("Error occurred", "error");
      expect(getState().toasts[0].type).toBe("error");
    });

    it("addToast supports success type", () => {
      getState().addToast("Done!", "success");
      expect(getState().toasts[0].type).toBe("success");
    });

    it("addToast accumulates multiple toasts", () => {
      getState().addToast("First", "info");
      getState().addToast("Second", "error");
      expect(getState().toasts).toHaveLength(2);
    });

    it("removeToast removes a specific toast", () => {
      vi.spyOn(crypto, "randomUUID")
        .mockReturnValueOnce("id-a" as `${string}-${string}-${string}-${string}-${string}`)
        .mockReturnValueOnce("id-b" as `${string}-${string}-${string}-${string}-${string}`);
      getState().addToast("A", "info");
      getState().addToast("B", "error");

      getState().removeToast("id-a");

      expect(getState().toasts).toHaveLength(1);
      expect(getState().toasts[0].id).toBe("id-b");
    });

    it("addToast auto-removes toast after 4 seconds", () => {
      vi.useFakeTimers();
      vi.spyOn(crypto, "randomUUID").mockReturnValue("auto-id" as `${string}-${string}-${string}-${string}-${string}`);

      getState().addToast("Temp", "info");
      expect(getState().toasts).toHaveLength(1);

      vi.advanceTimersByTime(4000);

      expect(getState().toasts).toHaveLength(0);
      vi.useRealTimers();
    });

    it("removeToast is no-op for unknown id", () => {
      getState().addToast("A", "info");
      getState().removeToast("nonexistent");
      expect(getState().toasts).toHaveLength(1);
    });
  });
});
