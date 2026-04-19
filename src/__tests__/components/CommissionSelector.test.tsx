import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommissionSelector } from "@/components/Editor/Commission/CommissionSelector";
import type { CommissionDefinition } from "@/lib/rpc/types";

const mockDefinitions: CommissionDefinition[] = [
  { name: "build", description: "Build the project" },
  { name: "lint", description: "Run linter checks" },
];

describe("CommissionSelector", () => {
  const defaultProps = {
    definitions: mockDefinitions,
    loading: false,
    error: null as string | null,
    onRun: vi.fn(),
    onAbort: vi.fn(),
    onRetry: vi.fn(),
    isRunning: false,
  };

  it("renders select with placeholder option", () => {
    render(<CommissionSelector {...defaultProps} />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByText("Select a commission...")).toBeInTheDocument();
  });

  it("renders all commission definitions as options", () => {
    render(<CommissionSelector {...defaultProps} />);
    expect(screen.getByRole("option", { name: "build" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "lint" })).toBeInTheDocument();
  });

  it("renders Run Commission button initially disabled", () => {
    render(<CommissionSelector {...defaultProps} />);
    const btn = screen.getByRole("button", { name: "Run Commission" });
    expect(btn).toBeDisabled();
  });

  it("enables Run button after selecting a commission", async () => {
    const user = userEvent.setup();
    render(<CommissionSelector {...defaultProps} />);

    await user.selectOptions(screen.getByRole("combobox"), "build");
    expect(screen.getByRole("button", { name: "Run Commission" })).toBeEnabled();
  });

  it("shows description when a commission is selected", async () => {
    const user = userEvent.setup();
    render(<CommissionSelector {...defaultProps} />);

    await user.selectOptions(screen.getByRole("combobox"), "build");
    expect(screen.getByText("Build the project")).toBeInTheDocument();
  });

  it("calls onRun with selected commission name on button click", async () => {
    const user = userEvent.setup();
    const onRun = vi.fn();
    render(<CommissionSelector {...defaultProps} onRun={onRun} />);

    await user.selectOptions(screen.getByRole("combobox"), "lint");
    await user.click(screen.getByRole("button", { name: "Run Commission" }));

    expect(onRun).toHaveBeenCalledWith("lint");
  });

  it("does not call onRun when no commission is selected", async () => {
    const user = userEvent.setup();
    const onRun = vi.fn();
    render(<CommissionSelector {...defaultProps} onRun={onRun} />);

    // Button is disabled, but verify onRun is not called
    expect(screen.getByRole("button", { name: "Run Commission" })).toBeDisabled();
    expect(onRun).not.toHaveBeenCalled();
  });

  it("shows Abort button when isRunning is true", () => {
    render(<CommissionSelector {...defaultProps} isRunning={true} />);

    expect(screen.getByRole("button", { name: "Abort" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Run Commission" })).not.toBeInTheDocument();
  });

  it("calls onAbort when Abort button is clicked", async () => {
    const user = userEvent.setup();
    const onAbort = vi.fn();
    render(<CommissionSelector {...defaultProps} onAbort={onAbort} isRunning={true} />);

    await user.click(screen.getByRole("button", { name: "Abort" }));
    expect(onAbort).toHaveBeenCalledOnce();
  });

  it("disables select when isRunning", () => {
    render(<CommissionSelector {...defaultProps} isRunning={true} />);
    expect(screen.getByRole("combobox")).toBeDisabled();
  });

  it("hides description when isRunning even if selected", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<CommissionSelector {...defaultProps} />);

    await user.selectOptions(screen.getByRole("combobox"), "build");
    expect(screen.getByText("Build the project")).toBeInTheDocument();

    rerender(<CommissionSelector {...defaultProps} isRunning={true} />);
    expect(screen.queryByText("Build the project")).not.toBeInTheDocument();
  });

  it("shows empty message when no definitions provided", () => {
    render(<CommissionSelector {...defaultProps} definitions={[]} />);
    expect(screen.getByText("No commissions available")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    render(<CommissionSelector {...defaultProps} loading={true} />);
    expect(screen.getByText("Loading commissions...")).toBeInTheDocument();
  });

  it("shows error state with retry button", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<CommissionSelector {...defaultProps} error="Network error" onRetry={onRetry} />);
    expect(screen.getByText("Network error")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("resets selection when selected commission is removed from definitions", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<CommissionSelector {...defaultProps} />);

    await user.selectOptions(screen.getByRole("combobox"), "build");
    expect(screen.getByRole("button", { name: "Run Commission" })).toBeEnabled();

    // definitionsからbuildが消えた場合、selectionがリセットされる
    const newDefs: CommissionDefinition[] = [
      { name: "deploy", description: "Deploy to production" },
    ];
    rerender(<CommissionSelector {...defaultProps} definitions={newDefs} />);
    expect(screen.getByRole("button", { name: "Run Commission" })).toBeDisabled();
  });

  it("keeps selection when selected commission still exists in new definitions", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<CommissionSelector {...defaultProps} />);

    await user.selectOptions(screen.getByRole("combobox"), "build");
    expect(screen.getByRole("button", { name: "Run Commission" })).toBeEnabled();

    // definitionsが変わってもbuildが残っていればselectionを維持
    const newDefs: CommissionDefinition[] = [
      { name: "build", description: "Build the project (updated)" },
      { name: "deploy", description: "Deploy to production" },
    ];
    rerender(<CommissionSelector {...defaultProps} definitions={newDefs} />);
    expect(screen.getByRole("button", { name: "Run Commission" })).toBeEnabled();
  });

  // ── Abort button with empty definitions (recent fix) ──

  it("shows Abort button when definitions are empty but isRunning is true", () => {
    render(
      <CommissionSelector {...defaultProps} definitions={[]} isRunning={true} />
    );

    expect(screen.getByRole("button", { name: "Abort" })).toBeInTheDocument();
    expect(screen.queryByText("No commissions available")).not.toBeInTheDocument();
  });

  // ── Params display ──

  it("shows parameter details when a commission with params is selected", async () => {
    const user = userEvent.setup();
    const defsWithParams: CommissionDefinition[] = [
      {
        name: "deploy",
        description: "Deploy to production",
        params: {
          target: { type: "string", description: "Deploy target", required: true },
          dryRun: { type: "boolean", description: "Dry run mode" },
        },
      },
    ];
    render(<CommissionSelector {...defaultProps} definitions={defsWithParams} />);

    await user.selectOptions(screen.getByRole("combobox"), "deploy");

    expect(screen.getByText("Parameters")).toBeInTheDocument();
    expect(screen.getByText("target")).toBeInTheDocument();
    expect(screen.getByText("string")).toBeInTheDocument();
    expect(screen.getByText("— Deploy target")).toBeInTheDocument();
    expect(screen.getByText("*")).toBeInTheDocument(); // required indicator
    expect(screen.getByText("dryRun")).toBeInTheDocument();
    expect(screen.getByText("boolean")).toBeInTheDocument();
  });

  it("does not show Parameters section when commission has no params", async () => {
    const user = userEvent.setup();
    render(<CommissionSelector {...defaultProps} />);

    await user.selectOptions(screen.getByRole("combobox"), "build");

    expect(screen.getByText("Build the project")).toBeInTheDocument();
    expect(screen.queryByText("Parameters")).not.toBeInTheDocument();
  });

  it("does not show Parameters section when params is empty object", async () => {
    const user = userEvent.setup();
    const defsEmptyParams: CommissionDefinition[] = [
      { name: "test", description: "Run tests", params: {} },
    ];
    render(<CommissionSelector {...defaultProps} definitions={defsEmptyParams} />);

    await user.selectOptions(screen.getByRole("combobox"), "test");

    expect(screen.getByText("Run tests")).toBeInTheDocument();
    expect(screen.queryByText("Parameters")).not.toBeInTheDocument();
  });
});
