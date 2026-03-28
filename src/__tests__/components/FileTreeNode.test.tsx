import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FileTreeNode } from "@/components/Editor/FileTreeNode";
import { useWorkspaceStore } from "@/stores/workspace";
import type { TreeEntry } from "@/lib/rpc/types";

const dirEntry: TreeEntry = {
  name: "src",
  path: "/src",
  type: "directory",
  children: [
    { name: "index.ts", path: "/src/index.ts", type: "file" },
    { name: "utils.ts", path: "/src/utils.ts", type: "file" },
  ],
};

const fileEntry: TreeEntry = {
  name: "README.md",
  path: "/README.md",
  type: "file",
};

describe("FileTreeNode", () => {
  it("renders file name", () => {
    render(
      <ul role="tree">
        <FileTreeNode entry={fileEntry} depth={0} onToggle={vi.fn()} onFileSelect={vi.fn()} />
      </ul>
    );
    expect(screen.getByText("README.md")).toBeInTheDocument();
  });

  it("renders directory with collapse chevron", () => {
    render(
      <ul role="tree">
        <FileTreeNode entry={dirEntry} depth={0} onToggle={vi.fn()} onFileSelect={vi.fn()} />
      </ul>
    );
    expect(screen.getByText("src")).toBeInTheDocument();
    expect(screen.getByText("▸")).toBeInTheDocument();
  });

  it("calls onToggle when directory is clicked", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(
      <ul role="tree">
        <FileTreeNode entry={dirEntry} depth={0} onToggle={onToggle} onFileSelect={vi.fn()} />
      </ul>
    );

    await user.click(screen.getByText("src"));
    expect(onToggle).toHaveBeenCalledWith("/src");
  });

  it("calls onFileSelect when file is clicked", async () => {
    const user = userEvent.setup();
    const onFileSelect = vi.fn();
    render(
      <ul role="tree">
        <FileTreeNode entry={fileEntry} depth={0} onToggle={vi.fn()} onFileSelect={onFileSelect} />
      </ul>
    );

    await user.click(screen.getByText("README.md"));
    expect(onFileSelect).toHaveBeenCalledWith("/README.md");
  });

  it("shows children when directory is expanded", () => {
    useWorkspaceStore.setState({ expandedPaths: new Set(["/src"]) });
    render(
      <ul role="tree">
        <FileTreeNode entry={dirEntry} depth={0} onToggle={vi.fn()} onFileSelect={vi.fn()} />
      </ul>
    );

    expect(screen.getByText("▾")).toBeInTheDocument();
    expect(screen.getByText("index.ts")).toBeInTheDocument();
    expect(screen.getByText("utils.ts")).toBeInTheDocument();
  });

  it("hides children when directory is collapsed", () => {
    render(
      <ul role="tree">
        <FileTreeNode entry={dirEntry} depth={0} onToggle={vi.fn()} onFileSelect={vi.fn()} />
      </ul>
    );

    expect(screen.queryByText("index.ts")).not.toBeInTheDocument();
  });

  it("sets aria-expanded on directory nodes", () => {
    render(
      <ul role="tree">
        <FileTreeNode entry={dirEntry} depth={0} onToggle={vi.fn()} onFileSelect={vi.fn()} />
      </ul>
    );

    const treeitem = screen.getByRole("treeitem");
    expect(treeitem).toHaveAttribute("aria-expanded", "false");
  });

  it("responds to Enter key", async () => {
    const user = userEvent.setup();
    const onFileSelect = vi.fn();
    render(
      <ul role="tree">
        <FileTreeNode entry={fileEntry} depth={0} onToggle={vi.fn()} onFileSelect={onFileSelect} />
      </ul>
    );

    const button = screen.getByRole("button");
    button.focus();
    await user.keyboard("{Enter}");
    expect(onFileSelect).toHaveBeenCalledWith("/README.md");
  });
});
