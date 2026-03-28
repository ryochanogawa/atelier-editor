import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GitPanel } from "@/components/Editor/Git/GitPanel";
import { useWorkspaceStore } from "@/stores/workspace";

// --- Mock RPC client ---
const mockCall = vi.fn();
vi.mock("@/lib/rpc/client", () => ({
  getRpcClient: () => ({
    call: mockCall,
  }),
}));

// Mock child components to focus on GitPanel logic
vi.mock("@/components/Editor/Git/GitStatusList", () => ({
  GitStatusList: ({ entries }: { entries: unknown[] }) => (
    <div data-testid="git-status-list">entries:{entries.length}</div>
  ),
}));
vi.mock("@/components/Editor/Git/CommitForm", () => ({
  CommitForm: ({ onCommit, disabled }: { onCommit: (msg: string) => void; disabled: boolean }) => (
    <button
      data-testid="commit-form"
      disabled={disabled}
      onClick={() => onCommit("test commit")}
    >
      CommitForm
    </button>
  ),
}));
vi.mock("@/components/Editor/Git/CommitLog", () => ({
  CommitLog: ({ entries }: { entries: unknown[] }) => (
    <div data-testid="commit-log">log:{entries.length}</div>
  ),
}));

describe("GitPanel", () => {
  beforeEach(() => {
    mockCall.mockReset();
    // Default: git.log returns empty
    mockCall.mockImplementation((method: string) => {
      if (method === "git.log") return Promise.resolve([]);
      return Promise.resolve({});
    });
  });

  // ── Rendering ──

  describe("rendering", () => {
    it("renders Source Control header", () => {
      render(<GitPanel />);
      expect(screen.getByText("Source Control")).toBeInTheDocument();
    });

    it("renders current branch name", () => {
      useWorkspaceStore.setState({
        currentBranch: { name: "feature/test", isCurrent: true, isRemote: false },
      });
      render(<GitPanel />);
      expect(screen.getByText("feature/test")).toBeInTheDocument();
    });

    it("renders child components", () => {
      render(<GitPanel />);
      expect(screen.getByTestId("git-status-list")).toBeInTheDocument();
      expect(screen.getByTestId("commit-form")).toBeInTheDocument();
      expect(screen.getByTestId("commit-log")).toBeInTheDocument();
    });

    it("loads commit log on mount", async () => {
      render(<GitPanel />);
      await vi.waitFor(() => {
        expect(mockCall).toHaveBeenCalledWith("git.log", { limit: 50 });
      });
    });
  });

  // ── Push button ──

  describe("push button", () => {
    it("is disabled when no remote configured", () => {
      useWorkspaceStore.setState({
        currentBranch: { name: "main", isCurrent: true, isRemote: false },
      });
      render(<GitPanel />);
      expect(screen.getByRole("button", { name: /Push/ })).toBeDisabled();
    });

    it("is enabled when remote is configured", () => {
      useWorkspaceStore.setState({
        currentBranch: { name: "main", isCurrent: true, isRemote: false, remote: "origin/main" },
      });
      render(<GitPanel />);
      expect(screen.getByRole("button", { name: /Push/ })).toBeEnabled();
    });

    it("shows ahead count on push button", () => {
      useWorkspaceStore.setState({
        currentBranch: { name: "main", isCurrent: true, isRemote: false, remote: "origin/main", ahead: 3 },
      });
      render(<GitPanel />);
      expect(screen.getByRole("button", { name: /Push/ })).toHaveTextContent("Push ↑3");
    });

    it("calls git.push and shows success toast on click", async () => {
      const user = userEvent.setup();
      useWorkspaceStore.setState({
        currentBranch: { name: "main", isCurrent: true, isRemote: false, remote: "origin/main" },
      });
      mockCall.mockImplementation((method: string) => {
        if (method === "git.push") return Promise.resolve({});
        if (method === "git.log") return Promise.resolve([]);
        return Promise.resolve({});
      });

      render(<GitPanel />);
      await user.click(screen.getByRole("button", { name: /Push/ }));

      await vi.waitFor(() => {
        expect(mockCall).toHaveBeenCalledWith("git.push", {});
        const toasts = useWorkspaceStore.getState().toasts;
        expect(toasts.some((t) => t.message === "Pushed successfully")).toBe(true);
      });
    });

    it("shows error toast on push failure", async () => {
      const user = userEvent.setup();
      useWorkspaceStore.setState({
        currentBranch: { name: "main", isCurrent: true, isRemote: false, remote: "origin/main" },
      });
      mockCall.mockImplementation((method: string) => {
        if (method === "git.push") return Promise.reject(new Error("Push rejected"));
        if (method === "git.log") return Promise.resolve([]);
        return Promise.resolve({});
      });

      render(<GitPanel />);
      await user.click(screen.getByRole("button", { name: /Push/ }));

      await vi.waitFor(() => {
        const toasts = useWorkspaceStore.getState().toasts;
        expect(toasts.some((t) => t.message === "Push rejected" && t.type === "error")).toBe(true);
      });
    });
  });

  // ── Commit handling ──

  describe("commit handling", () => {
    it("disables commit form when no staged files", () => {
      useWorkspaceStore.setState({
        gitStatus: [{ path: "/a.ts", status: "M" as const, staged: false }],
      });
      render(<GitPanel />);
      expect(screen.getByTestId("commit-form")).toBeDisabled();
    });

    it("enables commit form when staged files exist", () => {
      useWorkspaceStore.setState({
        gitStatus: [{ path: "/a.ts", status: "M" as const, staged: true }],
      });
      render(<GitPanel />);
      expect(screen.getByTestId("commit-form")).not.toBeDisabled();
    });

    it("calls git.commit and shows success toast on commit", async () => {
      const user = userEvent.setup();
      useWorkspaceStore.setState({
        gitStatus: [{ path: "/a.ts", status: "M" as const, staged: true }],
      });
      mockCall.mockImplementation((method: string) => {
        if (method === "git.commit") return Promise.resolve({ hash: "abc123" });
        if (method === "git.log") return Promise.resolve([]);
        return Promise.resolve({});
      });

      render(<GitPanel />);
      await user.click(screen.getByTestId("commit-form"));

      await vi.waitFor(() => {
        expect(mockCall).toHaveBeenCalledWith("git.commit", { message: "test commit" });
        const toasts = useWorkspaceStore.getState().toasts;
        expect(toasts.some((t) => t.message === "Committed: abc123")).toBe(true);
      });
    });

    it("refreshes commit log after successful commit", async () => {
      const user = userEvent.setup();
      useWorkspaceStore.setState({
        gitStatus: [{ path: "/a.ts", status: "M" as const, staged: true }],
      });
      const logEntries = [{ hash: "abc123", message: "test", author: "dev", date: "2024-01-01" }];
      mockCall.mockImplementation((method: string) => {
        if (method === "git.commit") return Promise.resolve({ hash: "abc123" });
        if (method === "git.log") return Promise.resolve(logEntries);
        return Promise.resolve({});
      });

      render(<GitPanel />);
      await user.click(screen.getByTestId("commit-form"));

      await vi.waitFor(() => {
        // git.log called on mount + after commit = at least 2
        const logCalls = mockCall.mock.calls.filter((c: unknown[]) => c[0] === "git.log");
        expect(logCalls.length).toBeGreaterThanOrEqual(2);
      });
    });

    it("shows error toast on commit failure", async () => {
      const user = userEvent.setup();
      useWorkspaceStore.setState({
        gitStatus: [{ path: "/a.ts", status: "M" as const, staged: true }],
      });
      mockCall.mockImplementation((method: string) => {
        if (method === "git.commit") return Promise.reject(new Error("Nothing to commit"));
        if (method === "git.log") return Promise.resolve([]);
        return Promise.resolve({});
      });

      render(<GitPanel />);
      await user.click(screen.getByTestId("commit-form"));

      await vi.waitFor(() => {
        const toasts = useWorkspaceStore.getState().toasts;
        expect(toasts.some((t) => t.message === "Nothing to commit" && t.type === "error")).toBe(true);
      });
    });
  });
});
