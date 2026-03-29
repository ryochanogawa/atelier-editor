import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CodeBlock } from "@/components/Editor/Chat/CodeBlock";

// Stable clipboard mock at module level
const mockWriteText = vi.fn().mockResolvedValue(undefined);
Object.defineProperty(navigator, "clipboard", {
  value: { writeText: mockWriteText },
  configurable: true,
});

describe("CodeBlock", () => {
  beforeEach(() => {
    mockWriteText.mockClear();
  });

  it("renders code content", () => {
    render(<CodeBlock code="const x = 1;" language="typescript" />);

    expect(screen.getByText("const x = 1;")).toBeInTheDocument();
  });

  it("shows language label", () => {
    render(<CodeBlock code="print('hi')" language="python" />);

    expect(screen.getByText("python")).toBeInTheDocument();
  });

  it("shows 'code' as fallback when no language", () => {
    render(<CodeBlock code="hello" />);

    expect(screen.getByText("code")).toBeInTheDocument();
  });

  it("renders Copy button", () => {
    render(<CodeBlock code="test" />);

    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
  });

  it("shows 'Copied!' feedback after copying (verifies clipboard was called)", async () => {
    const user = userEvent.setup();
    render(<CodeBlock code="const x = 42;" />);

    await user.click(screen.getByRole("button", { name: "Copy" }));

    // "Copied!" only appears if navigator.clipboard.writeText resolved successfully
    await vi.waitFor(() => {
      expect(screen.getByText("Copied!")).toBeInTheDocument();
    });
  });

  it("renders Apply button when onApplyToFile is provided", () => {
    render(<CodeBlock code="test" onApplyToFile={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Apply" })).toBeInTheDocument();
  });

  it("does not render Apply button when onApplyToFile is not provided", () => {
    render(<CodeBlock code="test" />);

    expect(screen.queryByRole("button", { name: "Apply" })).not.toBeInTheDocument();
  });

  it("calls onApplyToFile with code when Apply is clicked", async () => {
    const onApply = vi.fn();
    const user = userEvent.setup();
    render(<CodeBlock code="const y = 99;" onApplyToFile={onApply} />);

    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(onApply).toHaveBeenCalledWith("const y = 99;");
  });
});
