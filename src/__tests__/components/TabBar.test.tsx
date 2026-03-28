import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TabBar } from "@/components/Editor/TabBar";
import { useWorkspaceStore } from "@/stores/workspace";
import type { OpenFile } from "@/stores/workspace";

function setupTabs(files: OpenFile[], activeTab: string) {
  const openFiles = new Map(files.map((f) => [f.path, f]));
  const tabOrder = files.map((f) => f.path);
  useWorkspaceStore.setState({ openFiles, tabOrder, activeTab });
}

const fileA: OpenFile = { path: "/src/a.ts", content: "a", originalContent: "a", language: "typescript" };
const fileB: OpenFile = { path: "/src/b.ts", content: "b changed", originalContent: "b", language: "typescript" };

describe("TabBar", () => {
  it("renders nothing when no tabs are open", () => {
    const { container } = render(<TabBar />);
    expect(container.firstChild).toBeNull();
  });

  it("renders tab for each open file", () => {
    setupTabs([fileA, fileB], fileA.path);
    render(<TabBar />);
    expect(screen.getByText("a.ts")).toBeInTheDocument();
    expect(screen.getByText("b.ts")).toBeInTheDocument();
  });

  it("shows dirty indicator for modified files", () => {
    setupTabs([fileB], fileB.path);
    render(<TabBar />);
    // fileB has content !== originalContent, so dirty dot should show
    expect(screen.getByText("●")).toBeInTheDocument();
  });

  it("does not show dirty indicator for clean files", () => {
    setupTabs([fileA], fileA.path);
    render(<TabBar />);
    expect(screen.queryByText("●")).not.toBeInTheDocument();
  });

  it("clicking tab sets it active", async () => {
    const user = userEvent.setup();
    setupTabs([fileA, fileB], fileA.path);
    render(<TabBar />);

    await user.click(screen.getByText("b.ts"));
    expect(useWorkspaceStore.getState().activeTab).toBe(fileB.path);
  });

  it("clicking close button removes the file", async () => {
    const user = userEvent.setup();
    setupTabs([fileA, fileB], fileA.path);
    render(<TabBar />);

    const closeButtons = screen.getAllByRole("button", { name: "×" });
    await user.click(closeButtons[0]); // close first tab (fileA)

    const state = useWorkspaceStore.getState();
    expect(state.openFiles.has(fileA.path)).toBe(false);
    expect(state.tabOrder).not.toContain(fileA.path);
  });
});
