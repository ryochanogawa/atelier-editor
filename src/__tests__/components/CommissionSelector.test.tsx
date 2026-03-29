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
    onRun: vi.fn(),
    onAbort: vi.fn(),
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

  it("renders empty select when no definitions provided", () => {
    render(<CommissionSelector {...defaultProps} definitions={[]} />);
    // Only the placeholder option
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("Select a commission...");
  });
});
