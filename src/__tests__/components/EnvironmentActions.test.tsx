import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EnvironmentActions } from "@/components/Editor/Environment/EnvironmentActions";
import { useWorkspaceStore } from "@/stores/workspace";

// Mock RPC client
const mockCall = vi.fn().mockResolvedValue({});
vi.mock("@/lib/rpc/client", () => ({
  getRpcClient: () => ({ call: mockCall }),
}));

describe("EnvironmentActions", () => {
  beforeEach(() => {
    mockCall.mockReset().mockResolvedValue({});
  });

  // ── Button visibility by status ──

  it("shows Start and Remove buttons when idle", () => {
    render(<EnvironmentActions worktreeId="wt-1" status="idle" />);

    expect(screen.getByText("Start")).toBeInTheDocument();
    expect(screen.getByText("Remove")).toBeInTheDocument();
    expect(screen.queryByText("Stop")).not.toBeInTheDocument();
    expect(screen.queryByText("Restart")).not.toBeInTheDocument();
  });

  it("shows Stop and Restart buttons when running", () => {
    render(<EnvironmentActions worktreeId="wt-1" status="running" />);

    expect(screen.getByText("Stop")).toBeInTheDocument();
    expect(screen.getByText("Restart")).toBeInTheDocument();
    expect(screen.queryByText("Start")).not.toBeInTheDocument();
  });

  it("shows Start and Remove buttons when stopped", () => {
    render(<EnvironmentActions worktreeId="wt-1" status="stopped" />);

    expect(screen.getByText("Start")).toBeInTheDocument();
    expect(screen.getByText("Remove")).toBeInTheDocument();
  });

  it("shows Retry and Remove buttons when error", () => {
    render(<EnvironmentActions worktreeId="wt-1" status="error" />);

    expect(screen.getByText("Retry")).toBeInTheDocument();
    expect(screen.getByText("Remove")).toBeInTheDocument();
  });

  it("shows Building spinner when building", () => {
    render(<EnvironmentActions worktreeId="wt-1" status="building" />);

    expect(screen.getByText("Building...")).toBeInTheDocument();
    expect(screen.queryByText("Start")).not.toBeInTheDocument();
    expect(screen.queryByText("Stop")).not.toBeInTheDocument();
  });

  it("shows Setting up spinner when setup", () => {
    render(<EnvironmentActions worktreeId="wt-1" status="setup" />);

    expect(screen.getByText("Setting up...")).toBeInTheDocument();
  });

  // ── Remove button disabled for idle ──

  it("Remove button is disabled when idle", () => {
    render(<EnvironmentActions worktreeId="wt-1" status="idle" />);

    expect(screen.getByText("Remove")).toBeDisabled();
  });

  it("Remove button is enabled when stopped", () => {
    render(<EnvironmentActions worktreeId="wt-1" status="stopped" />);

    expect(screen.getByText("Remove")).not.toBeDisabled();
  });

  // ── RPC calls ──

  it("calls environment.start when Start clicked", async () => {
    const user = userEvent.setup();
    render(<EnvironmentActions worktreeId="wt-1" status="idle" />);

    await user.click(screen.getByText("Start"));

    expect(mockCall).toHaveBeenCalledWith("environment.start", { worktreeId: "wt-1" });
  });

  it("calls environment.stop when Stop clicked", async () => {
    const user = userEvent.setup();
    render(<EnvironmentActions worktreeId="wt-1" status="running" />);

    await user.click(screen.getByText("Stop"));

    expect(mockCall).toHaveBeenCalledWith("environment.stop", { worktreeId: "wt-1" });
  });

  it("calls environment.restart when Restart clicked", async () => {
    const user = userEvent.setup();
    render(<EnvironmentActions worktreeId="wt-1" status="running" />);

    await user.click(screen.getByText("Restart"));

    expect(mockCall).toHaveBeenCalledWith("environment.restart", { worktreeId: "wt-1" });
  });

  it("calls environment.remove when Remove clicked", async () => {
    const user = userEvent.setup();
    render(<EnvironmentActions worktreeId="wt-1" status="stopped" />);

    await user.click(screen.getByText("Remove"));

    expect(mockCall).toHaveBeenCalledWith("environment.remove", { worktreeId: "wt-1" });
  });

  // ── Error handling ──

  it("shows toast on RPC error", async () => {
    const user = userEvent.setup();
    mockCall.mockRejectedValueOnce(new Error("connection failed"));
    render(<EnvironmentActions worktreeId="wt-1" status="idle" />);

    await user.click(screen.getByText("Start"));

    await waitFor(() => {
      const toasts = useWorkspaceStore.getState().toasts;
      expect(toasts.some((t) => t.message.includes("connection failed"))).toBe(true);
    });
  });
});
