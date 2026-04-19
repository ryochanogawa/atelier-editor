import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommissionPanel } from "@/components/Editor/Commission/CommissionPanel";
import { useWorkspaceStore } from "@/stores/workspace";

// Mock getRpcClient
const mockCall = vi.fn();
vi.mock("@/lib/rpc/client", () => ({
  getRpcClient: () => ({ call: mockCall }),
}));

describe("CommissionPanel", () => {
  beforeEach(() => {
    mockCall.mockReset();
    // Default: commission.list returns empty
    mockCall.mockResolvedValue([]);
    // CommissionPanel now guards fetch behind connectionStatus === "connected"
    useWorkspaceStore.setState({ status: "connected" });
  });

  it("renders Commission heading", () => {
    render(<CommissionPanel />);
    expect(screen.getByText("Commission")).toBeInTheDocument();
  });

  it("fetches commission definitions on mount", () => {
    render(<CommissionPanel />);
    expect(mockCall).toHaveBeenCalledWith("commission.list", { worktreeId: undefined });
  });

  it("renders CommissionSelector with fetched definitions", async () => {
    mockCall.mockResolvedValueOnce([
      { name: "build", description: "Build project" },
    ]);

    render(<CommissionPanel />);

    await vi.waitFor(() => {
      expect(screen.getByRole("option", { name: "build" })).toBeInTheDocument();
    });
  });

  it("shows Run Commission button when not running", async () => {
    mockCall.mockResolvedValueOnce([{ name: "build", description: "Build" }]);
    render(<CommissionPanel />);
    await vi.waitFor(() => {
      expect(screen.getByRole("button", { name: "Run Commission" })).toBeInTheDocument();
    });
  });

  it("shows Abort button when commission is running", () => {
    useWorkspaceStore.setState({
      commissionStatus: "running",
      activeCommissionId: "c-1",
    });

    render(<CommissionPanel />);
    expect(screen.getByRole("button", { name: "Abort" })).toBeInTheDocument();
  });

  it("does not show progress/strokes when commissionStatus is null", () => {
    render(<CommissionPanel />);
    expect(screen.queryByText("Log")).not.toBeInTheDocument();
    expect(screen.queryByText("Strokes")).not.toBeInTheDocument();
  });

  it("shows progress and log when commission is running", () => {
    useWorkspaceStore.setState({
      commissionStatus: "running",
      activeCommissionId: "c-1",
    });

    render(<CommissionPanel />);
    expect(screen.getByText("Log")).toBeInTheDocument();
  });

  it("shows Result and Clear button when commission is completed", () => {
    useWorkspaceStore.setState({
      commissionStatus: "completed",
      activeCommissionId: "c-1",
      commissionResult: {
        status: "success",
        summary: "Done",
        changedFiles: [],
      },
    });

    render(<CommissionPanel />);
    expect(screen.getByText("Result")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
  });

  it("does not show Clear button when commission is running", () => {
    useWorkspaceStore.setState({
      commissionStatus: "running",
      activeCommissionId: "c-1",
    });

    render(<CommissionPanel />);
    expect(screen.queryByRole("button", { name: "Clear" })).not.toBeInTheDocument();
  });

  it("clears commission state when Clear is clicked", async () => {
    const user = userEvent.setup();
    useWorkspaceStore.setState({
      commissionStatus: "completed",
      activeCommissionId: "c-1",
      commissionResult: { status: "success", summary: "Done", changedFiles: [] },
      commissionLogs: [
        { phase: "build", message: "ok", progress: 100, timestamp: "2026-01-01T00:00:00Z" },
      ],
    });

    render(<CommissionPanel />);
    await user.click(screen.getByRole("button", { name: "Clear" }));

    expect(useWorkspaceStore.getState().activeCommissionId).toBeNull();
    expect(useWorkspaceStore.getState().commissionStatus).toBeNull();
    expect(useWorkspaceStore.getState().commissionLogs).toEqual([]);
  });

  it("calls commission.run when Run is clicked with selected commission", async () => {
    const user = userEvent.setup();
    mockCall
      .mockResolvedValueOnce([{ name: "build", description: "Build" }]) // commission.list
      .mockResolvedValueOnce({ commissionId: "c-new" }); // commission.run

    render(<CommissionPanel />);

    await vi.waitFor(() => {
      expect(screen.getByRole("option", { name: "build" })).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByRole("combobox"), "build");
    await user.click(screen.getByRole("button", { name: "Run Commission" }));

    expect(mockCall).toHaveBeenCalledWith("commission.run", { commissionName: "build", worktreeId: undefined });
  });

  it("calls commission.abort when Abort is clicked", async () => {
    const user = userEvent.setup();
    useWorkspaceStore.setState({
      commissionStatus: "running",
      activeCommissionId: "c-1",
    });
    mockCall
      .mockResolvedValueOnce([]) // commission.list on mount
      .mockResolvedValueOnce({ success: true }); // commission.abort

    render(<CommissionPanel />);
    await user.click(screen.getByRole("button", { name: "Abort" }));

    expect(mockCall).toHaveBeenCalledWith("commission.abort", { commissionId: "c-1" });
  });

  it("shows error toast when commission.run fails", async () => {
    const user = userEvent.setup();
    mockCall
      .mockResolvedValueOnce([{ name: "build", description: "Build" }])
      .mockRejectedValueOnce(new Error("Server error"));

    render(<CommissionPanel />);

    await vi.waitFor(() => {
      expect(screen.getByRole("option", { name: "build" })).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByRole("combobox"), "build");
    await user.click(screen.getByRole("button", { name: "Run Commission" }));

    await vi.waitFor(() => {
      expect(useWorkspaceStore.getState().toasts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ message: "Server error", type: "error" }),
        ])
      );
    });
  });

  it("updates store after successful commission.run", async () => {
    const user = userEvent.setup();
    mockCall
      .mockResolvedValueOnce([{ name: "build", description: "Build" }])
      .mockResolvedValueOnce({ commissionId: "c-new" });

    render(<CommissionPanel />);

    await vi.waitFor(() => {
      expect(screen.getByRole("option", { name: "build" })).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByRole("combobox"), "build");
    await user.click(screen.getByRole("button", { name: "Run Commission" }));

    await vi.waitFor(() => {
      expect(useWorkspaceStore.getState().activeCommissionId).toBe("c-new");
      expect(useWorkspaceStore.getState().commissionStatus).toBe("running");
    });
  });

  it("shows error toast when commission.abort fails", async () => {
    const user = userEvent.setup();
    useWorkspaceStore.setState({
      commissionStatus: "running",
      activeCommissionId: "c-1",
    });
    mockCall
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error("Abort failed"));

    render(<CommissionPanel />);
    await user.click(screen.getByRole("button", { name: "Abort" }));

    await vi.waitFor(() => {
      expect(useWorkspaceStore.getState().toasts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ message: "Abort failed", type: "error" }),
        ])
      );
    });
  });

  it("handles commission.list fetch error silently", async () => {
    mockCall.mockRejectedValue(new Error("not supported"));

    // Should not throw
    render(<CommissionPanel />);

    await vi.waitFor(() => {
      expect(mockCall).toHaveBeenCalledWith("commission.list", { worktreeId: undefined });
    });
    // definitions remain empty
    expect(useWorkspaceStore.getState().commissionDefinitions).toEqual([]);
  });

  it("shows Result section when commission is failed", () => {
    useWorkspaceStore.setState({
      commissionStatus: "failed",
      activeCommissionId: "c-1",
      commissionResult: { status: "failure", error: "Oops" },
    });

    render(<CommissionPanel />);
    expect(screen.getByText("Result")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
  });
});
