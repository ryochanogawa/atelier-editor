import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CodeEditor } from "@/components/Editor/CodeEditor";
import { useWorkspaceStore } from "@/stores/workspace";

// next/dynamic is already mocked in setup.ts to return null
// We need to verify the logic around diff mode vs normal mode

describe("CodeEditor", () => {
  it("shows welcome message when no file is open", () => {
    render(<CodeEditor />);
    expect(screen.getByText("ATELIER Editor")).toBeInTheDocument();
    expect(screen.getByText("Open a file from the explorer to start editing")).toBeInTheDocument();
  });

  it("shows diff header when diffFile is set", () => {
    useWorkspaceStore.setState({
      diffFile: {
        path: "src/index.ts",
        original: "const a = 1;",
        modified: "const a = 2;",
      },
    });
    render(<CodeEditor />);

    expect(screen.getByText("Diff: src/index.ts")).toBeInTheDocument();
    expect(screen.getByText("Close Diff")).toBeInTheDocument();
  });

  it("clears diffFile when Close Diff is clicked", async () => {
    const user = userEvent.setup();
    useWorkspaceStore.setState({
      diffFile: {
        path: "src/index.ts",
        original: "old",
        modified: "new",
      },
    });
    render(<CodeEditor />);

    await user.click(screen.getByText("Close Diff"));

    expect(useWorkspaceStore.getState().diffFile).toBeNull();
  });

  it("prioritizes diff mode over file view", () => {
    const openFiles = new Map([
      ["src/index.ts", { path: "src/index.ts", content: "code", originalContent: "code", language: "typescript" }],
    ]);
    useWorkspaceStore.setState({
      activeTab: "src/index.ts",
      openFiles,
      diffFile: {
        path: "src/index.ts",
        original: "old",
        modified: "new",
      },
    });
    render(<CodeEditor />);

    // Should show diff header, not the editor
    expect(screen.getByText("Diff: src/index.ts")).toBeInTheDocument();
    expect(screen.queryByText("ATELIER Editor")).not.toBeInTheDocument();
  });
});
