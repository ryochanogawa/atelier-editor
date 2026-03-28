import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useConnection } from "@/hooks/useConnection";
import { useWorkspaceStore } from "@/stores/workspace";

// --- Mock RPC client ---
const mockCall = vi.fn();
const mockConnect = vi.fn();
const mockDisconnect = vi.fn();
const mockOnStatusChange = vi.fn();
const mockOnNotification = vi.fn();

vi.mock("@/lib/rpc/client", () => ({
  getRpcClient: () => ({
    call: mockCall,
    connect: mockConnect,
    disconnect: mockDisconnect,
    onStatusChange: mockOnStatusChange,
    onNotification: mockOnNotification,
  }),
}));

describe("useConnection", () => {
  let statusChangeCallback: (status: string) => void;
  let notificationCallbacks: Record<string, (params: unknown) => void>;
  let unsubStatus: ReturnType<typeof vi.fn>;
  let unsubWatch: ReturnType<typeof vi.fn>;
  let unsubGitChanged: ReturnType<typeof vi.fn>;
  let unsubStudioChanged: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    notificationCallbacks = {};
    unsubStatus = vi.fn();
    unsubWatch = vi.fn();
    unsubGitChanged = vi.fn();
    unsubStudioChanged = vi.fn();

    mockOnStatusChange.mockImplementation((cb: (status: string) => void) => {
      statusChangeCallback = cb;
      return unsubStatus;
    });

    mockOnNotification.mockImplementation((method: string, cb: (params: unknown) => void) => {
      notificationCallbacks[method] = cb;
      const unsubs: Record<string, ReturnType<typeof vi.fn>> = {
        "fs.watch": unsubWatch,
        "git.changed": unsubGitChanged,
        "studio.changed": unsubStudioChanged,
      };
      return unsubs[method] ?? vi.fn();
    });

    mockCall.mockReset();
    mockConnect.mockReset();
    mockDisconnect.mockReset();
    mockOnStatusChange.mockClear();
    mockOnNotification.mockClear();
  });

  // ── Connection setup ──

  describe("connection setup", () => {
    it("calls client.connect() on mount", () => {
      renderHook(() => useConnection());
      expect(mockConnect).toHaveBeenCalledOnce();
    });

    it("subscribes to status changes", () => {
      renderHook(() => useConnection());
      expect(mockOnStatusChange).toHaveBeenCalledOnce();
    });

    it("subscribes to fs.watch, git.changed, studio.changed notifications", () => {
      renderHook(() => useConnection());
      const methods = mockOnNotification.mock.calls.map((c: unknown[]) => c[0]);
      expect(methods).toContain("fs.watch");
      expect(methods).toContain("git.changed");
      expect(methods).toContain("studio.changed");
    });
  });

  // ── Status change handling ──

  describe("status change handling", () => {
    it("updates store status on status change", () => {
      renderHook(() => useConnection());
      statusChangeCallback("connecting");
      expect(useWorkspaceStore.getState().status).toBe("connecting");
    });

    it("initializes workspace when status becomes connected", async () => {
      const workspaceInfo = { name: "test", rootPath: "/test" };
      const tree = [{ name: "src", path: "/src", type: "directory" as const, children: [] }];
      const gitStatus = [{ path: "/a.ts", status: "modified" as const, staged: false }];
      const branches = [{ name: "main", current: true }];
      const worktrees = [{ id: "wt1", path: "/test", branch: "main", isMain: true }];

      mockCall.mockImplementation((method: string) => {
        const responses: Record<string, unknown> = {
          "workspace.info": workspaceInfo,
          "fs.readTree": tree,
          "git.status": gitStatus,
          "git.branches": branches,
          "studio.list": worktrees,
        };
        return Promise.resolve(responses[method]);
      });

      renderHook(() => useConnection());
      statusChangeCallback("connected");

      await vi.waitFor(() => {
        const state = useWorkspaceStore.getState();
        expect(state.workspaceInfo).toEqual(workspaceInfo);
        expect(state.tree).toEqual(tree);
        expect(state.gitStatus).toEqual(gitStatus);
        expect(state.branches).toEqual(branches);
        expect(state.worktrees).toEqual(worktrees);
      });
    });

    it("sets activeWorktreeId to main worktree", async () => {
      const worktrees = [
        { id: "wt1", path: "/a", branch: "feature", isMain: false },
        { id: "wt2", path: "/b", branch: "main", isMain: true },
      ];

      mockCall.mockImplementation((method: string) => {
        if (method === "studio.list") return Promise.resolve(worktrees);
        if (method === "git.branches") return Promise.resolve([{ name: "main", current: true }]);
        if (method === "git.status") return Promise.resolve([]);
        return Promise.resolve(method === "fs.readTree" ? [] : {});
      });

      renderHook(() => useConnection());
      statusChangeCallback("connected");

      await vi.waitFor(() => {
        expect(useWorkspaceStore.getState().activeWorktreeId).toBe("wt2");
      });
    });

    it("handles initWorkspace error gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockCall.mockRejectedValue(new Error("Connection failed"));

      renderHook(() => useConnection());
      statusChangeCallback("connected");

      await vi.waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith("Failed to initialize workspace:", expect.any(Error));
      });
      consoleSpy.mockRestore();
    });

    it("does not initWorkspace on non-connected status", () => {
      renderHook(() => useConnection());
      statusChangeCallback("reconnecting");
      expect(mockCall).not.toHaveBeenCalled();
    });

    it("does not set activeWorktreeId when no worktree has isMain=true", async () => {
      const worktrees = [
        { id: "wt1", path: "/a", branch: "feature-a", isMain: false },
        { id: "wt2", path: "/b", branch: "feature-b", isMain: false },
      ];

      mockCall.mockImplementation((method: string) => {
        if (method === "studio.list") return Promise.resolve(worktrees);
        if (method === "git.branches") return Promise.resolve([]);
        if (method === "git.status") return Promise.resolve([]);
        return Promise.resolve(method === "fs.readTree" ? [] : {});
      });

      renderHook(() => useConnection());
      statusChangeCallback("connected");

      await vi.waitFor(() => {
        expect(useWorkspaceStore.getState().worktrees).toEqual(worktrees);
      });

      // activeWorktreeId should remain null since no worktree has isMain=true
      expect(useWorkspaceStore.getState().activeWorktreeId).toBeNull();
    });

    it("calls all 5 RPC methods during initWorkspace", async () => {
      mockCall.mockImplementation((method: string) => {
        switch (method) {
          case "workspace.info": return Promise.resolve({ name: "test", rootPath: "/test" });
          case "fs.readTree": return Promise.resolve([]);
          case "git.status": return Promise.resolve([]);
          case "git.branches": return Promise.resolve([]);
          case "studio.list": return Promise.resolve([]);
          default: return Promise.resolve({});
        }
      });

      renderHook(() => useConnection());
      statusChangeCallback("connected");

      await vi.waitFor(() => {
        expect(mockCall).toHaveBeenCalledWith("workspace.info", expect.anything());
        expect(mockCall).toHaveBeenCalledWith("fs.readTree", expect.anything());
        expect(mockCall).toHaveBeenCalledWith("git.status", expect.anything());
        expect(mockCall).toHaveBeenCalledWith("git.branches", expect.anything());
        expect(mockCall).toHaveBeenCalledWith("studio.list", expect.anything());
      });
    });
  });

  // ── fs.watch notification ──

  describe("fs.watch notification", () => {
    it("reloads file on change event when file is open and clean", async () => {
      const openFiles = new Map([
        ["/src/a.ts", { path: "/src/a.ts", content: "original", originalContent: "original", language: "typescript" }],
      ]);
      useWorkspaceStore.setState({ openFiles });

      mockCall.mockResolvedValue({ path: "/src/a.ts", content: "updated", encoding: "utf-8" });

      renderHook(() => useConnection());
      notificationCallbacks["fs.watch"]({ path: "/src/a.ts", type: "change" });

      await vi.waitFor(() => {
        expect(mockCall).toHaveBeenCalledWith("fs.readFile", { path: "/src/a.ts" });
      });
    });

    it("does not reload dirty file on change event", () => {
      const openFiles = new Map([
        ["/src/a.ts", { path: "/src/a.ts", content: "modified", originalContent: "original", language: "typescript" }],
      ]);
      useWorkspaceStore.setState({ openFiles });

      renderHook(() => useConnection());
      notificationCallbacks["fs.watch"]({ path: "/src/a.ts", type: "change" });

      expect(mockCall).not.toHaveBeenCalled();
    });

    it("does not reload file that is not open", () => {
      renderHook(() => useConnection());
      notificationCallbacks["fs.watch"]({ path: "/src/unknown.ts", type: "change" });

      expect(mockCall).not.toHaveBeenCalled();
    });

    it("refreshes tree on create event", async () => {
      const newTree = [{ name: "new.ts", path: "/new.ts", type: "file" as const }];
      mockCall.mockResolvedValue(newTree);

      renderHook(() => useConnection());
      notificationCallbacks["fs.watch"]({ path: "/new.ts", type: "create" });

      await vi.waitFor(() => {
        expect(mockCall).toHaveBeenCalledWith("fs.readTree", {});
      });
    });

    it("refreshes tree on delete event", async () => {
      mockCall.mockResolvedValue([]);

      renderHook(() => useConnection());
      notificationCallbacks["fs.watch"]({ path: "/old.ts", type: "delete" });

      await vi.waitFor(() => {
        expect(mockCall).toHaveBeenCalledWith("fs.readTree", {});
      });
    });

    it("updates store tree after create event", async () => {
      const newTree = [{ name: "new.ts", path: "/new.ts", type: "file" as const }];
      mockCall.mockResolvedValue(newTree);

      renderHook(() => useConnection());
      notificationCallbacks["fs.watch"]({ path: "/new.ts", type: "create" });

      await vi.waitFor(() => {
        expect(useWorkspaceStore.getState().tree).toEqual(newTree);
      });
    });

    it("handles fs.readFile error silently on change event", async () => {
      const openFiles = new Map([
        ["/src/a.ts", { path: "/src/a.ts", content: "original", originalContent: "original", language: "typescript" }],
      ]);
      useWorkspaceStore.setState({ openFiles });

      mockCall.mockRejectedValue(new Error("File read failed"));

      renderHook(() => useConnection());
      // Should not throw
      notificationCallbacks["fs.watch"]({ path: "/src/a.ts", type: "change" });
    });

    it("handles fs.readTree error silently on create event", async () => {
      mockCall.mockRejectedValue(new Error("Tree read failed"));

      renderHook(() => useConnection());
      // Should not throw
      notificationCallbacks["fs.watch"]({ path: "/new.ts", type: "create" });
    });

    it("reloads file content in store after fs.watch change event", async () => {
      const openFiles = new Map([
        ["/src/a.ts", { path: "/src/a.ts", content: "original", originalContent: "original", language: "typescript" }],
      ]);
      useWorkspaceStore.setState({ openFiles });

      mockCall.mockResolvedValue({ path: "/src/a.ts", content: "updated-content", encoding: "utf-8" });

      renderHook(() => useConnection());
      notificationCallbacks["fs.watch"]({ path: "/src/a.ts", type: "change" });

      await vi.waitFor(() => {
        const file = useWorkspaceStore.getState().openFiles.get("/src/a.ts");
        expect(file?.content).toBe("updated-content");
        expect(file?.originalContent).toBe("updated-content");
      });
    });
  });

  // ── git.changed notification ──

  describe("git.changed notification", () => {
    it("refreshes git status and branches", async () => {
      const newStatus = [{ path: "/a.ts", status: "added" as const, staged: true }];
      const newBranches = [{ name: "main", current: true }];

      mockCall.mockImplementation((method: string) => {
        if (method === "git.status") return Promise.resolve(newStatus);
        if (method === "git.branches") return Promise.resolve(newBranches);
        return Promise.resolve({});
      });

      renderHook(() => useConnection());
      notificationCallbacks["git.changed"]({ worktreeId: "wt-1", type: "status" });

      await vi.waitFor(() => {
        expect(mockCall).toHaveBeenCalledWith("git.status", {});
        expect(mockCall).toHaveBeenCalledWith("git.branches", {});
        expect(useWorkspaceStore.getState().gitStatus).toEqual(newStatus);
        expect(useWorkspaceStore.getState().branches).toEqual(newBranches);
      });
    });

    it("handles git.changed error silently", async () => {
      mockCall.mockRejectedValue(new Error("git error"));

      renderHook(() => useConnection());
      // Should not throw
      notificationCallbacks["git.changed"]({});
    });
  });

  // ── studio.changed notification ──

  describe("studio.changed notification", () => {
    it("refreshes worktree list", async () => {
      const newWorktrees = [{ id: "wt1", path: "/test", branch: "main", isMain: true }];
      mockCall.mockResolvedValue(newWorktrees);

      renderHook(() => useConnection());
      notificationCallbacks["studio.changed"]({ type: "created", worktreeId: "wt-2" });

      await vi.waitFor(() => {
        expect(mockCall).toHaveBeenCalledWith("studio.list", {});
        expect(useWorkspaceStore.getState().worktrees).toEqual(newWorktrees);
      });
    });

    it("handles studio.changed error silently", async () => {
      mockCall.mockRejectedValue(new Error("studio error"));

      renderHook(() => useConnection());
      // Should not throw
      notificationCallbacks["studio.changed"]({});
    });
  });

  // ── Cleanup ──

  describe("cleanup", () => {
    it("unsubscribes all handlers and disconnects on unmount", () => {
      const { unmount } = renderHook(() => useConnection());
      unmount();

      expect(unsubStatus).toHaveBeenCalledOnce();
      expect(unsubWatch).toHaveBeenCalledOnce();
      expect(unsubGitChanged).toHaveBeenCalledOnce();
      expect(unsubStudioChanged).toHaveBeenCalledOnce();
      expect(mockDisconnect).toHaveBeenCalledOnce();
    });
  });
});
