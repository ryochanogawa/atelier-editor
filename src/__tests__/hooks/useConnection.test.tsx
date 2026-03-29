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
  let unsubCommissionProgress: ReturnType<typeof vi.fn>;
  let unsubCommissionStroke: ReturnType<typeof vi.fn>;
  let unsubCommissionCompleted: ReturnType<typeof vi.fn>;
  let unsubPreviewStatus: ReturnType<typeof vi.fn>;
  let unsubPreviewLog: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    notificationCallbacks = {};
    unsubStatus = vi.fn();
    unsubWatch = vi.fn();
    unsubGitChanged = vi.fn();
    unsubStudioChanged = vi.fn();
    unsubCommissionProgress = vi.fn();
    unsubCommissionStroke = vi.fn();
    unsubCommissionCompleted = vi.fn();
    unsubPreviewStatus = vi.fn();
    unsubPreviewLog = vi.fn();

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
        "commission.progress": unsubCommissionProgress,
        "commission.stroke": unsubCommissionStroke,
        "commission.completed": unsubCommissionCompleted,
        "preview.statusChange": unsubPreviewStatus,
        "preview.log": unsubPreviewLog,
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

    it("subscribes to all notification channels", () => {
      renderHook(() => useConnection());
      const methods = mockOnNotification.mock.calls.map((c: unknown[]) => c[0]);
      expect(methods).toContain("fs.watch");
      expect(methods).toContain("git.changed");
      expect(methods).toContain("studio.changed");
      expect(methods).toContain("commission.progress");
      expect(methods).toContain("commission.stroke");
      expect(methods).toContain("commission.completed");
      expect(methods).toContain("preview.statusChange");
      expect(methods).toContain("preview.log");
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

    it("does not call commission.list during initWorkspace (fetched by CommissionPanel)", async () => {
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
      });

      expect(mockCall).not.toHaveBeenCalledWith("commission.list", expect.anything());
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

  // ── commission.progress notification ──

  describe("commission.progress notification", () => {
    it("adds log entry when commissionId matches activeCommissionId", () => {
      useWorkspaceStore.setState({ activeCommissionId: "c-1" });

      renderHook(() => useConnection());
      notificationCallbacks["commission.progress"]({
        commissionId: "c-1",
        phase: "build",
        message: "Building...",
        progress: 50,
        timestamp: "2026-01-01T00:00:00Z",
      });

      const logs = useWorkspaceStore.getState().commissionLogs;
      expect(logs).toHaveLength(1);
      expect(logs[0]).toEqual({
        phase: "build",
        message: "Building...",
        progress: 50,
        timestamp: "2026-01-01T00:00:00Z",
      });
    });

    it("ignores notification when commissionId does not match", () => {
      useWorkspaceStore.setState({ activeCommissionId: "c-1" });

      renderHook(() => useConnection());
      notificationCallbacks["commission.progress"]({
        commissionId: "c-other",
        phase: "build",
        message: "Building...",
        progress: 50,
        timestamp: "2026-01-01T00:00:00Z",
      });

      expect(useWorkspaceStore.getState().commissionLogs).toEqual([]);
    });

    it("ignores notification when no activeCommissionId", () => {
      renderHook(() => useConnection());
      notificationCallbacks["commission.progress"]({
        commissionId: "c-1",
        phase: "build",
        message: "Building...",
        progress: 50,
        timestamp: "2026-01-01T00:00:00Z",
      });

      expect(useWorkspaceStore.getState().commissionLogs).toEqual([]);
    });

    it("updates commissionProgress from progress notification", () => {
      useWorkspaceStore.setState({ activeCommissionId: "c-1" });

      renderHook(() => useConnection());
      notificationCallbacks["commission.progress"]({
        commissionId: "c-1",
        phase: "build",
        message: "Building...",
        progress: 75,
        timestamp: "2026-01-01T00:00:00Z",
      });

      expect(useWorkspaceStore.getState().commissionProgress).toBe(75);
    });
  });

  // ── commission.stroke notification ──

  describe("commission.stroke notification", () => {
    it("updates stroke when commissionId matches", () => {
      useWorkspaceStore.setState({ activeCommissionId: "c-1" });

      renderHook(() => useConnection());
      notificationCallbacks["commission.stroke"]({
        commissionId: "c-1",
        strokeId: "s-1",
        strokeName: "TypeCheck",
        status: "running",
      });

      const strokes = useWorkspaceStore.getState().commissionStrokes;
      expect(strokes).toHaveLength(1);
      expect(strokes[0]).toEqual({
        strokeId: "s-1",
        strokeName: "TypeCheck",
        status: "running",
      });
    });

    it("ignores stroke when commissionId does not match", () => {
      useWorkspaceStore.setState({ activeCommissionId: "c-1" });

      renderHook(() => useConnection());
      notificationCallbacks["commission.stroke"]({
        commissionId: "c-other",
        strokeId: "s-1",
        strokeName: "TypeCheck",
        status: "running",
      });

      expect(useWorkspaceStore.getState().commissionStrokes).toEqual([]);
    });

    it("ignores stroke when no activeCommissionId", () => {
      renderHook(() => useConnection());
      notificationCallbacks["commission.stroke"]({
        commissionId: "c-1",
        strokeId: "s-1",
        strokeName: "TypeCheck",
        status: "running",
      });

      expect(useWorkspaceStore.getState().commissionStrokes).toEqual([]);
    });
  });

  // ── commission.completed notification ──

  describe("commission.completed notification", () => {
    it("completes commission on success when commissionId matches", () => {
      useWorkspaceStore.setState({
        activeCommissionId: "c-1",
        commissionStatus: "running",
      });

      renderHook(() => useConnection());
      notificationCallbacks["commission.completed"]({
        commissionId: "c-1",
        status: "success",
        result: { changedFiles: ["a.ts"], summary: "Done" },
      });

      const state = useWorkspaceStore.getState();
      expect(state.commissionStatus).toBe("completed");
      expect(state.commissionResult?.status).toBe("success");
      expect(state.commissionResult?.changedFiles).toEqual(["a.ts"]);
      expect(state.commissionResult?.summary).toBe("Done");
    });

    it("completes commission on failure", () => {
      useWorkspaceStore.setState({
        activeCommissionId: "c-1",
        commissionStatus: "running",
      });

      renderHook(() => useConnection());
      notificationCallbacks["commission.completed"]({
        commissionId: "c-1",
        status: "failure",
        error: "Build failed",
      });

      const state = useWorkspaceStore.getState();
      expect(state.commissionStatus).toBe("failed");
      expect(state.commissionResult?.error).toBe("Build failed");
    });

    it("ignores completed when commissionId does not match", () => {
      useWorkspaceStore.setState({
        activeCommissionId: "c-1",
        commissionStatus: "running",
      });

      renderHook(() => useConnection());
      notificationCallbacks["commission.completed"]({
        commissionId: "c-other",
        status: "success",
        result: { changedFiles: [], summary: "Done" },
      });

      expect(useWorkspaceStore.getState().commissionStatus).toBe("running");
    });

    it("ignores completed when no activeCommissionId", () => {
      renderHook(() => useConnection());
      notificationCallbacks["commission.completed"]({
        commissionId: "c-1",
        status: "success",
        result: { changedFiles: [], summary: "Done" },
      });

      expect(useWorkspaceStore.getState().commissionStatus).toBeNull();
    });

    it("handles aborted status", () => {
      useWorkspaceStore.setState({
        activeCommissionId: "c-1",
        commissionStatus: "running",
      });

      renderHook(() => useConnection());
      notificationCallbacks["commission.completed"]({
        commissionId: "c-1",
        status: "aborted",
      });

      expect(useWorkspaceStore.getState().commissionStatus).toBe("aborted");
    });
  });

  // ── preview.statusChange notification ──

  describe("preview.statusChange notification", () => {
    it("updates dev server status, url, and port", () => {
      renderHook(() => useConnection());
      notificationCallbacks["preview.statusChange"]({
        status: "running",
        url: "http://localhost:3000",
        port: 3000,
      });

      const state = useWorkspaceStore.getState();
      expect(state.devServerStatus).toBe("running");
      expect(state.previewUrl).toBe("http://localhost:3000");
      expect(state.previewPort).toBe(3000);
    });

    it("sets preview error when error is present", () => {
      renderHook(() => useConnection());
      notificationCallbacks["preview.statusChange"]({
        status: "error",
        url: null,
        port: null,
        error: "Port already in use",
      });

      const state = useWorkspaceStore.getState();
      expect(state.devServerStatus).toBe("error");
      expect(state.previewError).toBe("Port already in use");
    });

    it("does not set error when error is absent", () => {
      renderHook(() => useConnection());
      notificationCallbacks["preview.statusChange"]({
        status: "starting",
        url: null,
        port: null,
      });

      expect(useWorkspaceStore.getState().previewError).toBeNull();
    });

    it("clears url on stop", () => {
      useWorkspaceStore.setState({
        devServerStatus: "running",
        previewUrl: "http://localhost:3000",
        previewPort: 3000,
      });

      renderHook(() => useConnection());
      notificationCallbacks["preview.statusChange"]({
        status: "stopped",
        url: null,
        port: null,
      });

      const state = useWorkspaceStore.getState();
      expect(state.devServerStatus).toBe("stopped");
      expect(state.previewUrl).toBeNull();
      expect(state.previewPort).toBeNull();
    });
  });

  // ── preview.log notification ──

  describe("preview.log notification", () => {
    it("adds log line to store", () => {
      renderHook(() => useConnection());
      notificationCallbacks["preview.log"]({
        line: "Server started on port 3000",
        timestamp: "2026-01-01T00:00:00Z",
      });

      expect(useWorkspaceStore.getState().previewLogs).toEqual([
        "Server started on port 3000",
      ]);
    });

    it("accumulates multiple log lines", () => {
      renderHook(() => useConnection());
      notificationCallbacks["preview.log"]({ line: "line-1", timestamp: "t1" });
      notificationCallbacks["preview.log"]({ line: "line-2", timestamp: "t2" });

      expect(useWorkspaceStore.getState().previewLogs).toEqual(["line-1", "line-2"]);
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
      expect(unsubCommissionProgress).toHaveBeenCalledOnce();
      expect(unsubCommissionStroke).toHaveBeenCalledOnce();
      expect(unsubCommissionCompleted).toHaveBeenCalledOnce();
      expect(unsubPreviewStatus).toHaveBeenCalledOnce();
      expect(unsubPreviewLog).toHaveBeenCalledOnce();
      expect(mockDisconnect).toHaveBeenCalledOnce();
    });
  });
});
