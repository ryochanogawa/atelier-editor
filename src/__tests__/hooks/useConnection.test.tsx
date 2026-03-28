import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
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

vi.mock("@/lib/rpc/client", () => ({
  getRpcClient: () => ({
    call: mockCall,
    connect: mockConnect,
    disconnect: mockDisconnect,
    onStatusChange: mockOnStatusChange,
    onNotification: mockOnNotification,
  }),
}));

import { useConnection } from "@/hooks/useConnection";

describe("useConnection", () => {
  beforeEach(() => {
    mockCall.mockReset();
    mockConnect.mockReset();
    mockDisconnect.mockReset();
    mockOnStatusChange.mockClear();
    mockOnNotification.mockClear();
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
  });

  // ── fs.watch notification ──

  describe("fs.watch handler", () => {
    it("reloads unchanged open file on change event", async () => {
      const openFiles = new Map([
        ["/src/a.ts", { path: "/src/a.ts", content: "original", originalContent: "original", language: "typescript" }],
      ]);
      useWorkspaceStore.setState({ openFiles });

      mockCall.mockImplementation((method: string) => {
        if (method === "fs.readFile") {
          return Promise.resolve({ path: "/src/a.ts", content: "updated", encoding: "utf-8" });
        }
        return Promise.resolve({});
      });

      renderHook(() => useConnection());

      const watchHandler = notificationHandlers.get("fs.watch")!;
      watchHandler({ path: "/src/a.ts", type: "change" });

      await vi.waitFor(() => {
        expect(mockCall).toHaveBeenCalledWith("fs.readFile", { path: "/src/a.ts" });
      });
    });

    it("does NOT reload dirty open file on change event", () => {
      const openFiles = new Map([
        ["/src/a.ts", { path: "/src/a.ts", content: "edited", originalContent: "original", language: "typescript" }],
      ]);
      useWorkspaceStore.setState({ openFiles });

      renderHook(() => useConnection());

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
      });
    });

    it("refreshes tree on delete event", async () => {
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
      });
    });
  });

  // ── git.changed notification ──

  describe("git.changed handler", () => {
    it("fetches git status and branches on git change", async () => {
      mockCall.mockImplementation((method: string) => {
        if (method === "git.status") {
          return Promise.resolve([{ path: "a.ts", status: "modified", staged: false }]);
        }
        if (method === "git.branches") {
          return Promise.resolve([{ name: "main", current: true }]);
        }
        return Promise.resolve({});
      });

      renderHook(() => useConnection());

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
    });
  });

  // ── studio.changed notification ──

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
    });
  });
});
