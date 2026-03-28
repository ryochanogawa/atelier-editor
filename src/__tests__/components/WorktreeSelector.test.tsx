import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorktreeSelector } from "@/components/Editor/WorktreeSelector";
import { useWorkspaceStore } from "@/stores/workspace";
import type { WorktreeInfo, GitBranch } from "@/lib/rpc/types";

const mockCall = vi.fn();
vi.mock("@/lib/rpc/client", () => ({
  getRpcClient: () => ({ call: mockCall }),
}));

const worktrees: WorktreeInfo[] = [
  { id: "wt-main", path: "/repo", branch: "main", isMain: true },
  { id: "wt-feat", path: "/repo-feat", branch: "feature", isMain: false },
];

const currentBranch: GitBranch = { name: "main", current: true };

describe("WorktreeSelector", () => {
  beforeEach(() => {
    mockCall.mockReset();
    useWorkspaceStore.setState({
      worktrees,
      activeWorktreeId: "wt-main",
      currentBranch,
    });
  });

  it("shows active worktree branch name", () => {
    render(<WorktreeSelector />);
    expect(screen.getByText("main")).toBeInTheDocument();
  });

  it("opens dropdown on click", async () => {
    const user = userEvent.setup();
    render(<WorktreeSelector />);

    await user.click(screen.getByText("main"));

    expect(screen.getByText("Worktrees")).toBeInTheDocument();
    expect(screen.getByText("feature")).toBeInTheDocument();
  });

  it("shows main label for isMain worktree", async () => {
    const user = userEvent.setup();
    render(<WorktreeSelector />);

    await user.click(screen.getByText("main"));

    // The "main" label badge next to the branch name
    const mainLabels = screen.getAllByText("main");
    expect(mainLabels.length).toBeGreaterThanOrEqual(2); // button + dropdown label
  });

  it("calls studio.switch when switching worktree", async () => {
    const user = userEvent.setup();
    mockCall.mockResolvedValue({ success: true });

    render(<WorktreeSelector />);

    await user.click(screen.getByText("main"));
    await user.click(screen.getByText("feature"));

    expect(mockCall).toHaveBeenCalledWith("studio.switch", { worktreeId: "wt-feat" });
  });

  it("updates activeWorktreeId after switch", async () => {
    const user = userEvent.setup();
    mockCall.mockResolvedValue({ success: true });

    render(<WorktreeSelector />);

    await user.click(screen.getByText("main"));
    await user.click(screen.getByText("feature"));

    await waitFor(() => {
      expect(useWorkspaceStore.getState().activeWorktreeId).toBe("wt-feat");
    });
  });

  it("does not call studio.switch when clicking already active worktree", async () => {
    const user = userEvent.setup();
    render(<WorktreeSelector />);

    await user.click(screen.getByText("main"));

    // Click the main worktree in dropdown (which is already active)
    const mainButtons = screen.getAllByText("main");
    // Find the one in the dropdown
    const dropdownMainButton = mainButtons.find(
      (el) => el.closest("[class*='absolute']") !== null
    );
    if (dropdownMainButton) {
      await user.click(dropdownMainButton);
    }

    expect(mockCall).not.toHaveBeenCalled();
  });

  it("shows toast on switch error", async () => {
    const user = userEvent.setup();
    mockCall.mockRejectedValue(new Error("Switch error"));

    render(<WorktreeSelector />);

    await user.click(screen.getByText("main"));
    await user.click(screen.getByText("feature"));

    await waitFor(() => {
      const toasts = useWorkspaceStore.getState().toasts;
      expect(toasts).toHaveLength(1);
      expect(toasts[0].message).toBe("Switch error");
      expect(toasts[0].type).toBe("error");
    });
  });

  it("shows remove button only for non-main worktrees", async () => {
    const user = userEvent.setup();
    render(<WorktreeSelector />);

    await user.click(screen.getByText("main"));

    const removeButtons = screen.getAllByTitle("Remove worktree");
    expect(removeButtons).toHaveLength(1); // only feature, not main
  });

  it("calls studio.remove when remove button clicked", async () => {
    const user = userEvent.setup();
    mockCall.mockResolvedValue({ success: true });

    render(<WorktreeSelector />);

    await user.click(screen.getByText("main"));
    await user.click(screen.getByTitle("Remove worktree"));

    expect(mockCall).toHaveBeenCalledWith("studio.remove", { worktreeId: "wt-feat" });
  });

  it("shows New Worktree button", async () => {
    const user = userEvent.setup();
    render(<WorktreeSelector />);

    await user.click(screen.getByText("main"));
    expect(screen.getByText("+ New Worktree")).toBeInTheDocument();
  });

  it("shows create form when New Worktree clicked", async () => {
    const user = userEvent.setup();
    render(<WorktreeSelector />);

    await user.click(screen.getByText("main"));
    await user.click(screen.getByText("+ New Worktree"));

    expect(screen.getByPlaceholderText("Branch name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "OK" })).toBeInTheDocument();
  });

  it("calls studio.create on Enter in branch name input", async () => {
    const user = userEvent.setup();
    mockCall.mockResolvedValue({ id: "wt-new", path: "/repo-new", branch: "new-branch", isMain: false });

    render(<WorktreeSelector />);

    await user.click(screen.getByText("main"));
    await user.click(screen.getByText("+ New Worktree"));
    await user.type(screen.getByPlaceholderText("Branch name"), "new-branch");
    await user.keyboard("{Enter}");

    expect(mockCall).toHaveBeenCalledWith("studio.create", { branch: "new-branch" });
  });

  it("calls studio.create on OK button click", async () => {
    const user = userEvent.setup();
    mockCall.mockResolvedValue({ id: "wt-new", path: "/repo-new", branch: "new-feat", isMain: false });

    render(<WorktreeSelector />);

    await user.click(screen.getByText("main"));
    await user.click(screen.getByText("+ New Worktree"));
    await user.type(screen.getByPlaceholderText("Branch name"), "new-feat");
    await user.click(screen.getByRole("button", { name: "OK" }));

    expect(mockCall).toHaveBeenCalledWith("studio.create", { branch: "new-feat" });
  });

  it("does not call studio.create when branch name is empty", async () => {
    const user = userEvent.setup();
    render(<WorktreeSelector />);

    await user.click(screen.getByText("main"));
    await user.click(screen.getByText("+ New Worktree"));
    await user.keyboard("{Enter}");

    expect(mockCall).not.toHaveBeenCalled();
  });

  it("cancels create form on Escape", async () => {
    const user = userEvent.setup();
    render(<WorktreeSelector />);

    await user.click(screen.getByText("main"));
    await user.click(screen.getByText("+ New Worktree"));

    expect(screen.getByPlaceholderText("Branch name")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByPlaceholderText("Branch name")).not.toBeInTheDocument();
    expect(screen.getByText("+ New Worktree")).toBeInTheDocument();
  });

  it("falls back to currentBranch.name when no active worktree", () => {
    useWorkspaceStore.setState({
      worktrees: [],
      activeWorktreeId: null,
      currentBranch: { name: "develop", current: true },
    });
    render(<WorktreeSelector />);

    expect(screen.getByText("develop")).toBeInTheDocument();
  });

  it("shows — when no branch info available", () => {
    useWorkspaceStore.setState({
      worktrees: [],
      activeWorktreeId: null,
      currentBranch: null,
    });
    render(<WorktreeSelector />);

    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
