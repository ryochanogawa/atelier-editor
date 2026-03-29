import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommissionResult } from "@/components/Editor/Commission/CommissionResult";
import { useWorkspaceStore } from "@/stores/workspace";

// Mock getRpcClient
const mockCall = vi.fn();
vi.mock("@/lib/rpc/client", () => ({
  getRpcClient: () => ({ call: mockCall }),
}));

describe("CommissionResult", () => {
  it("renders nothing when result is null", () => {
    const { container } = render(<CommissionResult />);
    expect(container.firstChild).toBeNull();
  });

  it("shows success message for successful result", () => {
    useWorkspaceStore.setState({
      commissionResult: {
        status: "success",
        changedFiles: [],
        summary: "All good",
      },
    });

    render(<CommissionResult />);
    expect(screen.getByText("Commission completed successfully")).toBeInTheDocument();
    expect(screen.getByText("Result")).toBeInTheDocument();
  });

  it("shows failure message with error", () => {
    useWorkspaceStore.setState({
      commissionResult: {
        status: "failure",
        error: "Build failed at step 3",
      },
    });

    render(<CommissionResult />);
    expect(
      screen.getByText("Commission failed: Build failed at step 3")
    ).toBeInTheDocument();
  });

  it("shows unknown error when no error message provided", () => {
    useWorkspaceStore.setState({
      commissionResult: { status: "failure" },
    });

    render(<CommissionResult />);
    expect(
      screen.getByText("Commission failed: Unknown error")
    ).toBeInTheDocument();
  });

  it("shows aborted message", () => {
    useWorkspaceStore.setState({
      commissionResult: { status: "aborted" },
    });

    render(<CommissionResult />);
    expect(screen.getByText("Commission was aborted")).toBeInTheDocument();
  });

  it("displays summary when provided", () => {
    useWorkspaceStore.setState({
      commissionResult: {
        status: "success",
        summary: "Updated 3 modules",
      },
    });

    render(<CommissionResult />);
    expect(screen.getByText("Updated 3 modules")).toBeInTheDocument();
  });

  it("displays changed files list", () => {
    useWorkspaceStore.setState({
      commissionResult: {
        status: "success",
        changedFiles: ["src/a.ts", "src/b.ts"],
        summary: "Done",
      },
    });

    render(<CommissionResult />);
    expect(screen.getByText("Changed files (2)")).toBeInTheDocument();
    expect(screen.getByText("src/a.ts")).toBeInTheDocument();
    expect(screen.getByText("src/b.ts")).toBeInTheDocument();
  });

  it("does not show changed files section when list is empty", () => {
    useWorkspaceStore.setState({
      commissionResult: {
        status: "success",
        changedFiles: [],
        summary: "No changes",
      },
    });

    render(<CommissionResult />);
    expect(screen.queryByText(/Changed files/)).not.toBeInTheDocument();
  });

  it("calls git.diff via RPC when clicking a changed file", async () => {
    const user = userEvent.setup();
    const mockDiff = { path: "src/a.ts", original: "old", modified: "new" };
    mockCall.mockResolvedValueOnce(mockDiff);

    useWorkspaceStore.setState({
      commissionResult: {
        status: "success",
        changedFiles: ["src/a.ts"],
        summary: "Done",
      },
    });

    render(<CommissionResult />);
    await user.click(screen.getByText("src/a.ts"));

    expect(mockCall).toHaveBeenCalledWith("git.diff", { path: "src/a.ts" });
  });

  it("handles git.diff error silently on file click", async () => {
    const user = userEvent.setup();
    mockCall.mockRejectedValueOnce(new Error("diff failed"));

    useWorkspaceStore.setState({
      commissionResult: {
        status: "success",
        changedFiles: ["src/a.ts"],
        summary: "Done",
      },
    });

    render(<CommissionResult />);
    // Should not throw
    await user.click(screen.getByText("src/a.ts"));

    // diffFile should remain null
    expect(useWorkspaceStore.getState().diffFile).toBeNull();
  });

  it("does not show summary when not provided", () => {
    useWorkspaceStore.setState({
      commissionResult: {
        status: "success",
        changedFiles: ["src/a.ts"],
      },
    });

    render(<CommissionResult />);
    expect(screen.getByText("Commission completed successfully")).toBeInTheDocument();
    // No extra paragraph besides the status and file list
    expect(screen.queryByText("undefined")).not.toBeInTheDocument();
  });

  it("sets diffFile in store when file click succeeds", async () => {
    const user = userEvent.setup();
    const mockDiff = { path: "src/a.ts", original: "old", modified: "new" };
    mockCall.mockResolvedValueOnce(mockDiff);

    useWorkspaceStore.setState({
      commissionResult: {
        status: "success",
        changedFiles: ["src/a.ts"],
        summary: "Done",
      },
    });

    render(<CommissionResult />);
    await user.click(screen.getByText("src/a.ts"));

    // Wait for async operation
    await vi.waitFor(() => {
      expect(useWorkspaceStore.getState().diffFile).toEqual(mockDiff);
    });
  });
});
