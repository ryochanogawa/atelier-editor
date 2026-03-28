import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FileExplorer } from "@/components/Editor/FileExplorer";
import { useWorkspaceStore } from "@/stores/workspace";
import type { TreeEntry } from "@/lib/rpc/types";

// Mock RPC client
const mockCall = vi.fn();
vi.mock("@/lib/rpc/client", () => ({
  getRpcClient: () => ({
    call: mockCall,
  }),
}));

const mockTree: TreeEntry[] = [
  {
    name: "src",
    path: "/src",
    type: "directory",
    children: [
      { name: "index.ts", path: "/src/index.ts", type: "file" },
    ],
  },
  { name: "package.json", path: "/package.json", type: "file" },
];

describe("FileExplorer", () => {
  beforeEach(() => {
    mockCall.mockReset();
  });

  it("renders workspace name from store", () => {
    useWorkspaceStore.setState({
      workspaceInfo: { name: "my-project", rootPath: "/project" },
    });
    render(<FileExplorer />);
    expect(screen.getByText("my-project")).toBeInTheDocument();
  });

  it("renders 'Explorer' when no workspace info", () => {
    render(<FileExplorer />);
    expect(screen.getByText("Explorer")).toBeInTheDocument();
  });

  it("renders file tree entries", () => {
    useWorkspaceStore.setState({ tree: mockTree });
    render(<FileExplorer />);
    expect(screen.getByText("src")).toBeInTheDocument();
    expect(screen.getByText("package.json")).toBeInTheDocument();
  });

  it("has accessible file explorer navigation", () => {
    useWorkspaceStore.setState({ tree: mockTree });
    render(<FileExplorer />);
    expect(screen.getByRole("navigation", { name: "File explorer" })).toBeInTheDocument();
    expect(screen.getByRole("tree")).toBeInTheDocument();
  });

  it("toggles directory expansion on click", async () => {
    const user = userEvent.setup();
    useWorkspaceStore.setState({ tree: mockTree });
    render(<FileExplorer />);

    await user.click(screen.getByText("src"));
    expect(useWorkspaceStore.getState().expandedPaths.has("/src")).toBe(true);
  });

  it("loads file via RPC when file is selected", async () => {
    const user = userEvent.setup();
    mockCall.mockResolvedValue({
      path: "/package.json",
      content: "{}",
      encoding: "utf-8",
      language: "json",
    });
    useWorkspaceStore.setState({ tree: mockTree });
    render(<FileExplorer />);

    await user.click(screen.getByText("package.json"));

    await waitFor(() => {
      expect(mockCall).toHaveBeenCalledWith("fs.readFile", { path: "/package.json" });
    });

    await waitFor(() => {
      const state = useWorkspaceStore.getState();
      expect(state.openFiles.has("/package.json")).toBe(true);
      expect(state.tabOrder).toContain("/package.json");
    });
  });

  it("does not re-fetch already open file", async () => {
    const user = userEvent.setup();
    const openFiles = new Map([
      ["/package.json", { path: "/package.json", content: "{}", originalContent: "{}", language: "json" }],
    ]);
    useWorkspaceStore.setState({
      tree: mockTree,
      openFiles,
      tabOrder: ["/package.json"],
    });
    render(<FileExplorer />);

    await user.click(screen.getByText("package.json"));
    expect(mockCall).not.toHaveBeenCalled();
    expect(useWorkspaceStore.getState().activeTab).toBe("/package.json");
  });
});
