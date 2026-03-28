import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
<<<<<<< HEAD
import { useConnection } from "@/hooks/useConnection";
import { useWorkspaceStore } from "@/stores/workspace";

// --- Mock RPC client ---
const mockCall = vi.fn();
const mockConnect = vi.fn();
const mockDisconnect = vi.fn();
const mockOnStatusChange = vi.fn();
const mockOnNotification = vi.fn();
=======
import { useWorkspaceStore } from "@/stores/workspace";

// Mock RPC client
const mockCall = vi.fn();
const mockConnect = vi.fn();
const mockDisconnect = vi.fn();

let statusHandler: ((status: string) => void) | null = null;
const notificationHandlers = new Map<string, (params: unknown) => void>();

const mockOnStatusChange = vi.fn((handler: (status: string) => void) => {
  statusHandler = handler;
  return vi.fn(); // unsub
});

const mockOnNotification = vi.fn((method: string, handler: (params: unknown) => void) => {
  notificationHandlers.set(method, handler);
  return vi.fn(); // unsub
});
>>>>>>> atelier/run_4-9mDfvOM8SN

vi.mock("@/lib/rpc/client", () => ({
  getRpcClient: () => ({
    call: mockCall,
    connect: mockConnect,
    disconnect: mockDisconnect,
    onStatusChange: mockOnStatusChange,
    onNotification: mockOnNotification,
  }),
}));

<<<<<<< HEAD
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

=======
import { useConnection } from "@/hooks/useConnection";

describe("useConnection", () => {
  beforeEach(() => {
>>>>>>> atelier/run_4-9mDfvOM8SN
    mockCall.mockReset();
    mockConnect.mockReset();
    mockDisconnect.mockReset();
    mockOnStatusChange.mockClear();
    mockOnNotification.mockClear();
<<<<<<< HEAD
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
      const gitStatus = [{ path: "/a.ts", status: "M" as const, staged: false }];
      const branches = [{ name: "main", isCurrent: true, isRemote: false }];
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
      const branches = [{ name: "main", current: true, isRemote: false }];

      mockCall.mockImplementation((method: string) => {
        if (method === "studio.list") return Promise.resolve(worktrees);
        if (method === "git.branches") return Promise.resolve(branches);
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
=======
    statusHandler = null;
    notificationHandlers.clear();
  });

  // ── Initialization ──

  it("calls client.connect() on mount", () => {
    renderHook(() => useConnection());
    expect(mockConnect).toHaveBeenCalledOnce();
  });

  it("subscribes to status changes and notifications", () => {
    renderHook(() => useConnection());

    expect(mockOnStatusChange).toHaveBeenCalledOnce();
    expect(mockOnNotification).toHaveBeenCalledTimes(3);

    const notifMethods = mockOnNotification.mock.calls.map((c) => c[0]);
    expect(notifMethods).toContain("fs.watch");
    expect(notifMethods).toContain("git.changed");
    expect(notifMethods).toContain("studio.changed");
  });

  it("disconnects and unsubscribes on unmount", () => {
    const { unmount } = renderHook(() => useConnection());
    unmount();
    expect(mockDisconnect).toHaveBeenCalledOnce();
  });

  // ── Status change → store sync ──

  it("syncs connection status to store", () => {
    renderHook(() => useConnection());

    statusHandler?.("connecting");
    expect(useWorkspaceStore.getState().status).toBe("connecting");

    statusHandler?.("connected");
    expect(useWorkspaceStore.getState().status).toBe("connected");
  });

  // ── initWorkspace on "connected" ──

  it("calls initWorkspace when status becomes connected", async () => {
    mockCall.mockImplementation((method: string) => {
      switch (method) {
        case "workspace.info":
          return Promise.resolve({ name: "test", rootPath: "/test" });
        case "fs.readTree":
          return Promise.resolve([{ name: "src", path: "/src", type: "directory" }]);
        case "git.status":
          return Promise.resolve([]);
        case "git.branches":
          return Promise.resolve([{ name: "main", current: true }]);
        case "studio.list":
          return Promise.resolve([{ id: "wt-1", path: "/repo", branch: "main", isMain: true }]);
        default:
          return Promise.resolve({});
      }
    });

    renderHook(() => useConnection());
    statusHandler?.("connected");

    await vi.waitFor(() => {
      expect(mockCall).toHaveBeenCalledWith("workspace.info", expect.anything());
      expect(mockCall).toHaveBeenCalledWith("fs.readTree", expect.anything());
      expect(mockCall).toHaveBeenCalledWith("git.status", expect.anything());
      expect(mockCall).toHaveBeenCalledWith("git.branches", expect.anything());
      expect(mockCall).toHaveBeenCalledWith("studio.list", expect.anything());
    });

    await vi.waitFor(() => {
      const state = useWorkspaceStore.getState();
      expect(state.workspaceInfo).toEqual({ name: "test", rootPath: "/test" });
      expect(state.tree).toHaveLength(1);
      expect(state.branches).toHaveLength(1);
      expect(state.activeWorktreeId).toBe("wt-1");
    });
  });

  it("sets activeWorktreeId to isMain worktree", async () => {
    mockCall.mockImplementation((method: string) => {
      switch (method) {
        case "workspace.info":
          return Promise.resolve({ name: "test", rootPath: "/test" });
        case "fs.readTree":
          return Promise.resolve([]);
        case "git.status":
          return Promise.resolve([]);
        case "git.branches":
          return Promise.resolve([]);
        case "studio.list":
          return Promise.resolve([
            { id: "wt-feat", path: "/feat", branch: "feat", isMain: false },
            { id: "wt-main", path: "/repo", branch: "main", isMain: true },
          ]);
        default:
          return Promise.resolve({});
      }
    });

    renderHook(() => useConnection());
    statusHandler?.("connected");

    await vi.waitFor(() => {
      expect(useWorkspaceStore.getState().activeWorktreeId).toBe("wt-main");
    });
  });

  it("handles initWorkspace error gracefully", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockCall.mockRejectedValue(new Error("Network error"));

    renderHook(() => useConnection());
    statusHandler?.("connected");

    await vi.waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to initialize workspace:",
        expect.any(Error)
      );
    });
    consoleSpy.mockRestore();
>>>>>>> atelier/run_4-9mDfvOM8SN
  });

  // ── fs.watch notification ──

<<<<<<< HEAD
  describe("fs.watch notification", () => {
    it("reloads file on change event when file is open and clean", async () => {
=======
  describe("fs.watch handler", () => {
    it("reloads unchanged open file on change event", async () => {
>>>>>>> atelier/run_4-9mDfvOM8SN
      const openFiles = new Map([
        ["/src/a.ts", { path: "/src/a.ts", content: "original", originalContent: "original", language: "typescript" }],
      ]);
      useWorkspaceStore.setState({ openFiles });

<<<<<<< HEAD
      mockCall.mockResolvedValue({ content: "updated", language: "typescript" });

      renderHook(() => useConnection());
      notificationCallbacks["fs.watch"]({ path: "/src/a.ts", type: "change" });
=======
      mockCall.mockImplementation((method: string) => {
        if (method === "fs.readFile") {
          return Promise.resolve({ path: "/src/a.ts", content: "updated", encoding: "utf-8" });
        }
        return Promise.resolve({});
      });

      renderHook(() => useConnection());

      const watchHandler = notificationHandlers.get("fs.watch")!;
      watchHandler({ path: "/src/a.ts", type: "change" });
>>>>>>> atelier/run_4-9mDfvOM8SN

      await vi.waitFor(() => {
        expect(mockCall).toHaveBeenCalledWith("fs.readFile", { path: "/src/a.ts" });
      });
    });

<<<<<<< HEAD
    it("does not reload dirty file on change event", () => {
      const openFiles = new Map([
        ["/src/a.ts", { path: "/src/a.ts", content: "modified", originalContent: "original", language: "typescript" }],
=======
    it("does NOT reload dirty open file on change event", () => {
      const openFiles = new Map([
        ["/src/a.ts", { path: "/src/a.ts", content: "edited", originalContent: "original", language: "typescript" }],
>>>>>>> atelier/run_4-9mDfvOM8SN
      ]);
      useWorkspaceStore.setState({ openFiles });

      renderHook(() => useConnection());
<<<<<<< HEAD
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
=======

      const watchHandler = notificationHandlers.get("fs.watch")!;
      watchHandler({ path: "/src/a.ts", type: "change" });

      expect(mockCall).not.toHaveBeenCalledWith("fs.readFile", expect.anything());
    });

    it("refreshes tree on create event", async () => {
      mockCall.mockImplementation((method: string) => {
        if (method === "fs.readTree") {
          return Promise.resolve([{ name: "new.ts", path: "/new.ts", type: "file" }]);
        }
        return Promise.resolve({});
      });

      renderHook(() => useConnection());

      const watchHandler = notificationHandlers.get("fs.watch")!;
      watchHandler({ path: "/new.ts", type: "create" });

      await vi.waitFor(() => {
        expect(mockCall).toHaveBeenCalledWith("fs.readTree", expect.anything());
>>>>>>> atelier/run_4-9mDfvOM8SN
      });
    });

    it("refreshes tree on delete event", async () => {
<<<<<<< HEAD
      mockCall.mockResolvedValue([]);

      renderHook(() => useConnection());
      notificationCallbacks["fs.watch"]({ path: "/old.ts", type: "delete" });

      await vi.waitFor(() => {
        expect(mockCall).toHaveBeenCalledWith("fs.readTree", {});
=======
      mockCall.mockImplementation((method: string) => {
        if (method === "fs.readTree") {
          return Promise.resolve([]);
        }
        return Promise.resolve({});
      });

      renderHook(() => useConnection());

      const watchHandler = notificationHandlers.get("fs.watch")!;
      watchHandler({ path: "/old.ts", type: "delete" });

      await vi.waitFor(() => {
        expect(mockCall).toHaveBeenCalledWith("fs.readTree", expect.anything());
>>>>>>> atelier/run_4-9mDfvOM8SN
      });
    });
  });

  // ── git.changed notification ──

<<<<<<< HEAD
  describe("git.changed notification", () => {
    it("refreshes git status and branches", async () => {
      const newStatus = [{ path: "/a.ts", status: "A" as const, staged: true }];
      const newBranches = [{ name: "main", isCurrent: true, isRemote: false }];

      mockCall.mockImplementation((method: string) => {
        if (method === "git.status") return Promise.resolve(newStatus);
        if (method === "git.branches") return Promise.resolve(newBranches);
=======
  describe("git.changed handler", () => {
    it("fetches git status and branches on git change", async () => {
      mockCall.mockImplementation((method: string) => {
        if (method === "git.status") {
          return Promise.resolve([{ path: "a.ts", status: "modified", staged: false }]);
        }
        if (method === "git.branches") {
          return Promise.resolve([{ name: "main", current: true }]);
        }
>>>>>>> atelier/run_4-9mDfvOM8SN
        return Promise.resolve({});
      });

      renderHook(() => useConnection());
<<<<<<< HEAD
      notificationCallbacks["git.changed"]({});

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
=======

      const gitHandler = notificationHandlers.get("git.changed")!;
      gitHandler({ worktreeId: "wt-1", type: "status" });

      await vi.waitFor(() => {
        expect(mockCall).toHaveBeenCalledWith("git.status", expect.anything());
        expect(mockCall).toHaveBeenCalledWith("git.branches", expect.anything());
      });

      await vi.waitFor(() => {
        expect(useWorkspaceStore.getState().gitStatus).toHaveLength(1);
        expect(useWorkspaceStore.getState().branches).toHaveLength(1);
      });
>>>>>>> atelier/run_4-9mDfvOM8SN
    });
  });

  // ── studio.changed notification ──

<<<<<<< HEAD
  describe("studio.changed notification", () => {
    it("refreshes worktree list", async () => {
      const newWorktrees = [{ id: "wt1", path: "/test", branch: "main", isMain: true }];
      mockCall.mockResolvedValue(newWorktrees);

      renderHook(() => useConnection());
      notificationCallbacks["studio.changed"]({});

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
=======
  describe("studio.changed handler", () => {
    it("fetches worktree list on studio change", async () => {
      mockCall.mockImplementation((method: string) => {
        if (method === "studio.list") {
          return Promise.resolve([{ id: "wt-1", path: "/repo", branch: "main", isMain: true }]);
        }
        return Promise.resolve({});
      });

      renderHook(() => useConnection());

      const studioHandler = notificationHandlers.get("studio.changed")!;
      studioHandler({ type: "created", worktreeId: "wt-2" });

      await vi.waitFor(() => {
        expect(mockCall).toHaveBeenCalledWith("studio.list", expect.anything());
      });

      await vi.waitFor(() => {
        expect(useWorkspaceStore.getState().worktrees).toHaveLength(1);
      });
>>>>>>> atelier/run_4-9mDfvOM8SN
    });
  });
});
