import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GitStatusItem } from "@/components/Editor/Git/GitStatusItem";
import { useWorkspaceStore } from "@/stores/workspace";
import type { GitStatusEntry } from "@/lib/rpc/types";

// Mock RPC client
const mockCall = vi.fn();
vi.mock("@/lib/rpc/client", () => ({
  getRpcClient: () => ({ call: mockCall }),
}));

describe("GitStatusItem", () => {
  beforeEach(() => {
    mockCall.mockReset();
  });

  const stagedEntry: GitStatusEntry = {
    path: "src/components/App.tsx",
    status: "modified",
    staged: true,
  };

  const unstagedEntry: GitStatusEntry = {
    path: "src/utils/helper.ts",
    status: "added",
    staged: false,
  };

  it("displays file name and directory path", () => {
    render(<GitStatusItem entry={stagedEntry} />);

    expect(screen.getByText("App.tsx")).toBeInTheDocument();
    expect(screen.getByText("src/components")).toBeInTheDocument();
  });

  it("displays status icon M for modified", () => {
    render(<GitStatusItem entry={stagedEntry} />);
    expect(screen.getByText("M")).toBeInTheDocument();
  });

  it("displays status icon A for added", () => {
    render(<GitStatusItem entry={unstagedEntry} />);
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("displays status icon D for deleted", () => {
    const deleted: GitStatusEntry = { path: "old.ts", status: "deleted", staged: false };
    render(<GitStatusItem entry={deleted} />);
    expect(screen.getByText("D")).toBeInTheDocument();
  });

  it("displays status icon R for renamed", () => {
    const renamed: GitStatusEntry = { path: "new.ts", status: "renamed", staged: true };
    render(<GitStatusItem entry={renamed} />);
    expect(screen.getByText("R")).toBeInTheDocument();
  });

  it("displays status icon U for untracked", () => {
    const untracked: GitStatusEntry = { path: "new-file.ts", status: "untracked", staged: false };
    render(<GitStatusItem entry={untracked} />);
    expect(screen.getByText("U")).toBeInTheDocument();
  });

  it("shows − button for staged entry (unstage)", () => {
    render(<GitStatusItem entry={stagedEntry} />);
    expect(screen.getByTitle("Unstage")).toBeInTheDocument();
  });

  it("shows + button for unstaged entry (stage)", () => {
    render(<GitStatusItem entry={unstagedEntry} />);
    expect(screen.getByTitle("Stage")).toBeInTheDocument();
  });

  it("calls git.unstage when − clicked on staged item", async () => {
    const user = userEvent.setup();
    mockCall.mockResolvedValue({ success: true });

    render(<GitStatusItem entry={stagedEntry} />);
    await user.click(screen.getByTitle("Unstage"));

    expect(mockCall).toHaveBeenCalledWith("git.unstage", { paths: ["src/components/App.tsx"] });
  });

  it("calls git.stage when + clicked on unstaged item", async () => {
    const user = userEvent.setup();
    mockCall.mockResolvedValue({ success: true });

    render(<GitStatusItem entry={unstagedEntry} />);
    await user.click(screen.getByTitle("Stage"));

    expect(mockCall).toHaveBeenCalledWith("git.stage", { paths: ["src/utils/helper.ts"] });
  });

  it("shows toast on stage/unstage error", async () => {
    const user = userEvent.setup();
    mockCall.mockRejectedValue(new Error("Stage failed"));

    render(<GitStatusItem entry={unstagedEntry} />);
    await user.click(screen.getByTitle("Stage"));

    const toasts = useWorkspaceStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe("Stage failed");
    expect(toasts[0].type).toBe("error");
  });

  it("calls git.diff and sets diffFile when file clicked", async () => {
    const user = userEvent.setup();
    const mockDiff = { path: "src/components/App.tsx", original: "old", modified: "new" };
    mockCall.mockResolvedValue(mockDiff);

    render(<GitStatusItem entry={stagedEntry} />);

    // Click the file name button (first button in the li)
    const fileButton = screen.getByText("App.tsx").closest("button")!;
    await user.click(fileButton);

    expect(mockCall).toHaveBeenCalledWith("git.diff", { path: "src/components/App.tsx" });
    expect(useWorkspaceStore.getState().diffFile).toEqual(mockDiff);
  });

  it("does not show directory path for root-level file", () => {
    const rootFile: GitStatusEntry = { path: "README.md", status: "modified", staged: false };
    render(<GitStatusItem entry={rootFile} />);

    expect(screen.getByText("README.md")).toBeInTheDocument();
    // No directory path should be rendered
    expect(screen.queryByText("/")).not.toBeInTheDocument();
  });
});
