import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DiffProposal } from "@/components/Editor/Chat/DiffProposal";
import type { CodeChange } from "@/lib/rpc/types";

function makeChange(overrides: Partial<CodeChange> = {}): CodeChange {
  return {
    changeId: "c1",
    filePath: "/src/app.ts",
    original: "const a = 1;",
    modified: "const a = 2;",
    status: "pending",
    ...overrides,
  };
}

describe("DiffProposal", () => {
  const defaultHandlers = {
    onAccept: vi.fn(),
    onReject: vi.fn(),
    onAcceptAll: vi.fn(),
    onRejectAll: vi.fn(),
  };

  it("renders file path for each change", () => {
    const changes = [makeChange({ filePath: "/src/app.ts" })];
    render(<DiffProposal changes={changes} {...defaultHandlers} />);

    expect(screen.getByText("/src/app.ts")).toBeInTheDocument();
  });

  it("shows Accept and Reject buttons for pending changes", () => {
    const changes = [makeChange({ status: "pending" })];
    render(<DiffProposal changes={changes} {...defaultHandlers} />);

    expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
  });

  it("shows 'Accepted' label for accepted changes", () => {
    const changes = [makeChange({ status: "accepted" })];
    render(<DiffProposal changes={changes} {...defaultHandlers} />);

    expect(screen.getByText("Accepted")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument();
  });

  it("shows 'Rejected' label for rejected changes", () => {
    const changes = [makeChange({ status: "rejected" })];
    render(<DiffProposal changes={changes} {...defaultHandlers} />);

    expect(screen.getByText("Rejected")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
  });

  it("calls onAccept with changeId when Accept is clicked", async () => {
    const onAccept = vi.fn();
    const user = userEvent.setup();
    const changes = [makeChange({ changeId: "c42" })];
    render(<DiffProposal changes={changes} {...defaultHandlers} onAccept={onAccept} />);

    await user.click(screen.getByRole("button", { name: "Accept" }));

    expect(onAccept).toHaveBeenCalledWith("c42");
  });

  it("calls onReject with changeId when Reject is clicked", async () => {
    const onReject = vi.fn();
    const user = userEvent.setup();
    const changes = [makeChange({ changeId: "c42" })];
    render(<DiffProposal changes={changes} {...defaultHandlers} onReject={onReject} />);

    await user.click(screen.getByRole("button", { name: "Reject" }));

    expect(onReject).toHaveBeenCalledWith("c42");
  });

  it("shows Accept All / Reject All buttons when multiple pending changes exist", () => {
    const changes = [
      makeChange({ changeId: "c1" }),
      makeChange({ changeId: "c2", filePath: "/src/lib.ts" }),
    ];
    render(<DiffProposal changes={changes} {...defaultHandlers} />);

    expect(screen.getByRole("button", { name: /Accept All/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject All" })).toBeInTheDocument();
  });

  it("shows pending count in Accept All button", () => {
    const changes = [
      makeChange({ changeId: "c1" }),
      makeChange({ changeId: "c2", filePath: "/src/lib.ts" }),
    ];
    render(<DiffProposal changes={changes} {...defaultHandlers} />);

    expect(screen.getByRole("button", { name: /Accept All \(2\)/ })).toBeInTheDocument();
  });

  it("does not show Accept All / Reject All for a single change", () => {
    const changes = [makeChange()];
    render(<DiffProposal changes={changes} {...defaultHandlers} />);

    expect(screen.queryByRole("button", { name: /Accept All/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject All" })).not.toBeInTheDocument();
  });

  it("does not show Accept All when no pending changes", () => {
    const changes = [
      makeChange({ changeId: "c1", status: "accepted" }),
      makeChange({ changeId: "c2", status: "rejected" }),
    ];
    render(<DiffProposal changes={changes} {...defaultHandlers} />);

    expect(screen.queryByRole("button", { name: /Accept All/ })).not.toBeInTheDocument();
  });

  it("calls onAcceptAll when Accept All is clicked", async () => {
    const onAcceptAll = vi.fn();
    const user = userEvent.setup();
    const changes = [makeChange({ changeId: "c1" }), makeChange({ changeId: "c2" })];
    render(<DiffProposal changes={changes} {...defaultHandlers} onAcceptAll={onAcceptAll} />);

    await user.click(screen.getByRole("button", { name: /Accept All/ }));

    expect(onAcceptAll).toHaveBeenCalledOnce();
  });

  it("calls onRejectAll when Reject All is clicked", async () => {
    const onRejectAll = vi.fn();
    const user = userEvent.setup();
    const changes = [makeChange({ changeId: "c1" }), makeChange({ changeId: "c2" })];
    render(<DiffProposal changes={changes} {...defaultHandlers} onRejectAll={onRejectAll} />);

    await user.click(screen.getByRole("button", { name: "Reject All" }));

    expect(onRejectAll).toHaveBeenCalledOnce();
  });

  it("renders diff lines showing additions and removals", () => {
    const changes = [
      makeChange({
        original: "line1\nold line\nline3",
        modified: "line1\nnew line\nline3",
      }),
    ];
    render(<DiffProposal changes={changes} {...defaultHandlers} />);

    expect(screen.getByText("old line")).toBeInTheDocument();
    expect(screen.getByText("new line")).toBeInTheDocument();
  });
});
