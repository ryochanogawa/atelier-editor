import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommitForm } from "@/components/Editor/Git/CommitForm";

describe("CommitForm", () => {
  it("renders textarea with placeholder", () => {
    render(<CommitForm onCommit={vi.fn()} disabled={false} />);
    expect(screen.getByPlaceholderText("Commit message")).toBeInTheDocument();
  });

  it("renders Commit button", () => {
    render(<CommitForm onCommit={vi.fn()} disabled={false} />);
    expect(screen.getByRole("button", { name: "Commit" })).toBeInTheDocument();
  });

  it("disables Commit button when disabled prop is true", () => {
    render(<CommitForm onCommit={vi.fn()} disabled={true} />);
    expect(screen.getByRole("button", { name: "Commit" })).toBeDisabled();
  });

  it("disables Commit button when message is empty", () => {
    render(<CommitForm onCommit={vi.fn()} disabled={false} />);
    expect(screen.getByRole("button", { name: "Commit" })).toBeDisabled();
  });

  it("enables Commit button when message is entered and not disabled", async () => {
    const user = userEvent.setup();
    render(<CommitForm onCommit={vi.fn()} disabled={false} />);

    await user.type(screen.getByPlaceholderText("Commit message"), "fix bug");
    expect(screen.getByRole("button", { name: "Commit" })).toBeEnabled();
  });

  it("calls onCommit with trimmed message on button click", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<CommitForm onCommit={onCommit} disabled={false} />);

    await user.type(screen.getByPlaceholderText("Commit message"), "  fix bug  ");
    await user.click(screen.getByRole("button", { name: "Commit" }));

    expect(onCommit).toHaveBeenCalledWith("fix bug");
  });

  it("clears message after commit", async () => {
    const user = userEvent.setup();
    render(<CommitForm onCommit={vi.fn()} disabled={false} />);

    const textarea = screen.getByPlaceholderText("Commit message");
    await user.type(textarea, "fix bug");
    await user.click(screen.getByRole("button", { name: "Commit" }));

    expect(textarea).toHaveValue("");
  });

  it("commits with Cmd+Enter shortcut", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<CommitForm onCommit={onCommit} disabled={false} />);

    const textarea = screen.getByPlaceholderText("Commit message");
    await user.type(textarea, "shortcut commit");
    await user.keyboard("{Meta>}{Enter}{/Meta}");

    expect(onCommit).toHaveBeenCalledWith("shortcut commit");
  });

  it("commits with Ctrl+Enter shortcut", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<CommitForm onCommit={onCommit} disabled={false} />);

    const textarea = screen.getByPlaceholderText("Commit message");
    await user.type(textarea, "ctrl commit");
    await user.keyboard("{Control>}{Enter}{/Control}");

    expect(onCommit).toHaveBeenCalledWith("ctrl commit");
  });

  it("does not commit with plain Enter", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<CommitForm onCommit={onCommit} disabled={false} />);

    await user.type(screen.getByPlaceholderText("Commit message"), "text");
    await user.keyboard("{Enter}");

    expect(onCommit).not.toHaveBeenCalled();
  });

  it("does not commit when message is only whitespace", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<CommitForm onCommit={onCommit} disabled={false} />);

    await user.type(screen.getByPlaceholderText("Commit message"), "   ");
    await user.click(screen.getByRole("button", { name: "Commit" }));

    expect(onCommit).not.toHaveBeenCalled();
  });
});
