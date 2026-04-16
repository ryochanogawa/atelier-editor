import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EnvironmentPanel } from "@/components/Editor/Environment/EnvironmentPanel";
import { useWorkspaceStore } from "@/stores/workspace";
import type { EnvironmentState } from "@/lib/environment/types";

// Mock RPC client
const mockCall = vi.fn().mockResolvedValue({});
vi.mock("@/lib/rpc/client", () => ({
  getRpcClient: () => ({ call: mockCall }),
}));

// Mock child components
vi.mock("@/components/Editor/Environment/EnvironmentCard", () => ({
  EnvironmentCard: ({ env, onViewLogs }: { env: EnvironmentState; onViewLogs: (id: string) => void }) => (
    <div data-testid={`env-card-${env.worktreeId}`}>
      <span>{env.branch}</span>
      <button onClick={() => onViewLogs(env.worktreeId)}>ViewLogs</button>
    </div>
  ),
}));

vi.mock("@/components/Editor/Environment/BuildLogViewer", () => ({
  BuildLogViewer: ({ logs }: { logs: string[] }) => (
    <div data-testid="build-log-viewer">Logs: {logs.length}</div>
  ),
}));

describe("EnvironmentPanel", () => {
  beforeEach(() => {
    mockCall.mockReset().mockResolvedValue({});
  });

  // ── Empty state ──

  it("shows empty state when no environments", () => {
    render(<EnvironmentPanel />);

    expect(screen.getByText("環境が設定されていません")).toBeInTheDocument();
    expect(screen.getByText(/environment\.yml/)).toBeInTheDocument();
  });

  // ── Header and tabs ──

  it("renders Environment header", () => {
    render(<EnvironmentPanel />);

    expect(screen.getByText("Environment")).toBeInTheDocument();
  });

  it("renders Overview and Logs tabs", () => {
    render(<EnvironmentPanel />);

    const buttons = screen.getAllByRole("button");
    const tabLabels = buttons.map((b) => b.textContent);
    expect(tabLabels).toContain("Overview");
    expect(tabLabels).toContain("Logs");
  });

  // ── Environment cards ──

  it("renders environment cards when environments exist", () => {
    useWorkspaceStore.setState({
      environments: {
        "wt-1": {
          worktreeId: "wt-1",
          branch: "main",
          status: "running",
          config: null,
          hostPort: 3001,
          containerId: "abc",
          error: null,
          setupCompleted: true,
          serviceStates: {},
        },
        "wt-2": {
          worktreeId: "wt-2",
          branch: "feature",
          status: "idle",
          config: null,
          hostPort: null,
          containerId: null,
          error: null,
          setupCompleted: false,
          serviceStates: {},
        },
      },
    });

    render(<EnvironmentPanel />);

    expect(screen.getByTestId("env-card-wt-1")).toBeInTheDocument();
    expect(screen.getByTestId("env-card-wt-2")).toBeInTheDocument();
    expect(screen.getByText("main")).toBeInTheDocument();
    expect(screen.getByText("feature")).toBeInTheDocument();
  });

  // ── Tab switching ──

  it("switches to logs tab when Logs tab clicked", async () => {
    const user = userEvent.setup();
    render(<EnvironmentPanel />);

    await user.click(screen.getByRole("button", { name: "Logs" }));

    expect(useWorkspaceStore.getState().environmentPanelTab).toBe("logs");
  });

  it("shows log prompt when on logs tab without selected worktree", async () => {
    const user = userEvent.setup();
    render(<EnvironmentPanel />);

    await user.click(screen.getByRole("button", { name: "Logs" }));

    expect(screen.getByText(/「Logs」をクリック/)).toBeInTheDocument();
  });

  it("switches to logs view and shows build log viewer when ViewLogs clicked on card", async () => {
    const user = userEvent.setup();
    useWorkspaceStore.setState({
      environments: {
        "wt-1": {
          worktreeId: "wt-1",
          branch: "main",
          status: "running",
          config: null,
          hostPort: null,
          containerId: null,
          error: null,
          setupCompleted: false,
          serviceStates: {},
        },
      },
      buildLogs: {
        "wt-1": ["log-line-1", "log-line-2"],
      },
    });

    render(<EnvironmentPanel />);

    await user.click(screen.getByText("ViewLogs"));

    expect(screen.getByTestId("build-log-viewer")).toBeInTheDocument();
    expect(screen.getByText("Logs: 2")).toBeInTheDocument();
  });

  // ── Back to overview ──

  it("shows Overview back button when on logs tab", async () => {
    const user = userEvent.setup();
    useWorkspaceStore.setState({ environmentPanelTab: "logs" });

    render(<EnvironmentPanel />);

    // The "Overview" link in the header area (not the tab)
    const overviewButtons = screen.getAllByRole("button", { name: "Overview" });
    // Should have the tab button plus the back link
    expect(overviewButtons.length).toBeGreaterThanOrEqual(2);
  });

  it("fetches environment status on mount", () => {
    render(<EnvironmentPanel />);

    expect(mockCall).toHaveBeenCalledWith(
      "environment.status",
      expect.any(Object)
    );
  });
});
