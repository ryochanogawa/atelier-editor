import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatInput } from "@/components/Editor/Chat/ChatInput";

describe("ChatInput", () => {
  const defaultProps = {
    status: "idle" as const,
    activeFilePath: null,
    onSend: vi.fn(),
    onAbort: vi.fn(),
  };

  it("renders textarea and Send button", () => {
    render(<ChatInput {...defaultProps} />);

    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
  });

  it("shows idle placeholder text", () => {
    render(<ChatInput {...defaultProps} />);

    expect(screen.getByPlaceholderText("Ask AI about your code... (Enter to send)")).toBeInTheDocument();
  });

  it("shows streaming placeholder when sending", () => {
    render(<ChatInput {...defaultProps} status="sending" />);

    expect(screen.getByPlaceholderText("AI is responding...")).toBeInTheDocument();
  });

  it("shows streaming placeholder when streaming", () => {
    render(<ChatInput {...defaultProps} status="streaming" />);

    expect(screen.getByPlaceholderText("AI is responding...")).toBeInTheDocument();
  });

  it("disables textarea during streaming", () => {
    render(<ChatInput {...defaultProps} status="streaming" />);

    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("shows Stop button instead of Send during streaming", () => {
    render(<ChatInput {...defaultProps} status="streaming" />);

    expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
  });

  it("Send button is disabled when input is empty", () => {
    render(<ChatInput {...defaultProps} />);

    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("Send button is enabled when input has text", async () => {
    const user = userEvent.setup();
    render(<ChatInput {...defaultProps} />);

    await user.type(screen.getByRole("textbox"), "Hello");

    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
  });

  it("calls onSend with trimmed message on Send click", async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    render(<ChatInput {...defaultProps} onSend={onSend} />);

    await user.type(screen.getByRole("textbox"), "  Hello AI  ");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(onSend).toHaveBeenCalledWith("Hello AI");
  });

  it("clears input after sending", async () => {
    const user = userEvent.setup();
    render(<ChatInput {...defaultProps} />);

    await user.type(screen.getByRole("textbox"), "Hello");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("sends message on Enter key", async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    render(<ChatInput {...defaultProps} onSend={onSend} />);

    await user.type(screen.getByRole("textbox"), "Hello{Enter}");

    expect(onSend).toHaveBeenCalledWith("Hello");
  });

  it("does not send on Shift+Enter (newline)", async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    render(<ChatInput {...defaultProps} onSend={onSend} />);

    await user.type(screen.getByRole("textbox"), "Hello{Shift>}{Enter}{/Shift}");

    expect(onSend).not.toHaveBeenCalled();
  });

  it("does not send empty message", async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    render(<ChatInput {...defaultProps} onSend={onSend} />);

    await user.type(screen.getByRole("textbox"), "   {Enter}");

    expect(onSend).not.toHaveBeenCalled();
  });

  it("calls onAbort when Stop button is clicked", async () => {
    const onAbort = vi.fn();
    const user = userEvent.setup();
    render(<ChatInput {...defaultProps} status="streaming" onAbort={onAbort} />);

    await user.click(screen.getByRole("button", { name: "Stop" }));

    expect(onAbort).toHaveBeenCalledOnce();
  });

  it("shows active file path when provided", () => {
    render(<ChatInput {...defaultProps} activeFilePath="/src/app.ts" />);

    expect(screen.getByText("/src/app.ts")).toBeInTheDocument();
  });

  it("does not show file indicator when no active file", () => {
    render(<ChatInput {...defaultProps} activeFilePath={null} />);

    expect(screen.queryByText(/\//)).not.toBeInTheDocument();
  });

  it("shows error message when status is error", () => {
    render(<ChatInput {...defaultProps} status="error" />);

    expect(screen.getByText("An error occurred. Please try again.")).toBeInTheDocument();
  });
});
