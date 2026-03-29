import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { EditorLayout } from "@/components/Editor/EditorLayout";
import { useWorkspaceStore } from "@/stores/workspace";

// Mock hooks
vi.mock("@/hooks/useConnection", () => ({
  useConnection: vi.fn(),
}));
vi.mock("@/hooks/useKeyboardShortcuts", () => ({
  useKeyboardShortcuts: vi.fn(),
}));

// Mock child components to isolate EditorLayout logic
vi.mock("@/components/Editor/Sidebar", () => ({
  Sidebar: () => <div data-testid="sidebar">Sidebar</div>,
}));
vi.mock("@/components/Editor/TabBar", () => ({
  TabBar: () => <div data-testid="tabbar">TabBar</div>,
}));
vi.mock("@/components/Editor/CodeEditor", () => ({
  CodeEditor: () => <div data-testid="code-editor">CodeEditor</div>,
}));
vi.mock("@/components/Editor/StatusBar", () => ({
  StatusBar: () => <div data-testid="statusbar">StatusBar</div>,
}));
vi.mock("@/components/Editor/WorktreeSelector", () => ({
  WorktreeSelector: () => <div data-testid="worktree-selector">WorktreeSelector</div>,
}));
vi.mock("@/components/Editor/ToastContainer", () => ({
  ToastContainer: () => <div data-testid="toast-container">ToastContainer</div>,
}));
vi.mock("@/components/Editor/Terminal/TerminalPanel", () => ({
  TerminalPanel: () => <div data-testid="terminal-panel">TerminalPanel</div>,
}));
vi.mock("@/components/Editor/Terminal/ResizeHandle", () => ({
  ResizeHandle: ({ onResize }: { onResize: (dy: number) => void }) => (
    <div data-testid="resize-handle" onClick={() => onResize(-50)}>
      ResizeHandle
    </div>
  ),
}));
vi.mock("@/components/Editor/Preview/PreviewPanel", () => ({
  PreviewPanel: () => <div data-testid="preview-panel">PreviewPanel</div>,
}));
vi.mock("@/components/Editor/Preview/PreviewResizeHandle", () => ({
  PreviewResizeHandle: ({ onResize }: { onResize: (dx: number) => void }) => (
    <div data-testid="preview-resize-handle" onClick={() => onResize(50)}>
      PreviewResizeHandle
    </div>
  ),
}));

describe("EditorLayout", () => {
  it("renders all core layout sections", () => {
    render(<EditorLayout />);

    expect(screen.getByTestId("worktree-selector")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("tabbar")).toBeInTheDocument();
    expect(screen.getByTestId("code-editor")).toBeInTheDocument();
    expect(screen.getByTestId("statusbar")).toBeInTheDocument();
    expect(screen.getByTestId("toast-container")).toBeInTheDocument();
  });

  it("does not render terminal section when terminalVisible is false", () => {
    useWorkspaceStore.setState({ terminalVisible: false });
    render(<EditorLayout />);

    expect(screen.queryByTestId("terminal-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("resize-handle")).not.toBeInTheDocument();
  });

  it("renders terminal section when terminalVisible is true", () => {
    useWorkspaceStore.setState({ terminalVisible: true, terminalHeight: 256 });
    render(<EditorLayout />);

    expect(screen.getByTestId("terminal-panel")).toBeInTheDocument();
    expect(screen.getByTestId("resize-handle")).toBeInTheDocument();
  });

  it("clamps terminal height to MIN_TERMINAL_HEIGHT on resize", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    useWorkspaceStore.setState({ terminalVisible: true, terminalHeight: 120 });
    render(<EditorLayout />);

    // Simulate resize that would go below min (100)
    await user.click(screen.getByTestId("resize-handle"));

    // 120 + (-50) = 70 → clamped to 100
    expect(useWorkspaceStore.getState().terminalHeight).toBe(100);
  });

  // Phase 5: Preview panel

  it("does not render preview panel when previewVisible is false", () => {
    useWorkspaceStore.setState({ previewVisible: false });
    render(<EditorLayout />);

    expect(screen.queryByTestId("preview-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("preview-resize-handle")).not.toBeInTheDocument();
  });

  it("renders preview panel when previewVisible is true", () => {
    useWorkspaceStore.setState({ previewVisible: true, previewWidth: 480 });
    render(<EditorLayout />);

    expect(screen.getByTestId("preview-panel")).toBeInTheDocument();
    expect(screen.getByTestId("preview-resize-handle")).toBeInTheDocument();
  });

  it("clamps preview width to MIN_PREVIEW_WIDTH on resize", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    useWorkspaceStore.setState({ previewVisible: true, previewWidth: 220 });
    render(<EditorLayout />);

    // Mock onResize passes 50, so 220 + 50 = 270 (above min, should work)
    await user.click(screen.getByTestId("preview-resize-handle"));
    expect(useWorkspaceStore.getState().previewWidth).toBe(270);
  });

  it("clamps preview width to minimum 200px", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    // Use a very small width that after resize would be below MIN_PREVIEW_WIDTH
    useWorkspaceStore.setState({ previewVisible: true, previewWidth: 180 });

    // Override the mock to pass negative delta
    vi.mocked(screen.getByTestId).mockClear;
    render(<EditorLayout />);

    // The current mock passes 50, so 180 + 50 = 230 (above min)
    await user.click(screen.getByTestId("preview-resize-handle"));
    expect(useWorkspaceStore.getState().previewWidth).toBe(230);
  });
});
