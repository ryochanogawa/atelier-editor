import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useInlineDiff } from "@/hooks/useInlineDiff";
import { useWorkspaceStore } from "@/stores/workspace";
import type { CodeChange } from "@/lib/rpc/types";

// Mock Monaco editor instance
function createMockEditor() {
  const mockCollection = {
    clear: vi.fn(),
  };

  return {
    getModel: vi.fn().mockReturnValue({
      getLineCount: vi.fn().mockReturnValue(10),
      getLineMaxColumn: vi.fn().mockReturnValue(80),
    }),
    createDecorationsCollection: vi.fn().mockReturnValue(mockCollection),
    removeContentWidget: vi.fn(),
    _mockCollection: mockCollection,
  };
}

describe("useInlineDiff", () => {
  let mockEditor: ReturnType<typeof createMockEditor>;

  beforeEach(() => {
    mockEditor = createMockEditor();
  });

  it("does nothing when editor is null", () => {
    useWorkspaceStore.setState({
      pendingChanges: [
        { changeId: "c1", filePath: "/app.ts", original: "a", modified: "b", status: "pending" },
      ],
    });

    renderHook(() => useInlineDiff(null, "/app.ts"));

    // No error should occur
  });

  it("does nothing when activeFilePath is null", () => {
    renderHook(() => useInlineDiff(mockEditor as never, null));

    expect(mockEditor.createDecorationsCollection).not.toHaveBeenCalled();
  });

  it("does nothing when no pending changes for active file", () => {
    useWorkspaceStore.setState({
      pendingChanges: [
        { changeId: "c1", filePath: "/other.ts", original: "a", modified: "b", status: "pending" },
      ],
    });

    renderHook(() => useInlineDiff(mockEditor as never, "/app.ts"));

    expect(mockEditor.createDecorationsCollection).not.toHaveBeenCalled();
  });

  it("ignores non-pending changes", () => {
    useWorkspaceStore.setState({
      pendingChanges: [
        { changeId: "c1", filePath: "/app.ts", original: "a", modified: "b", status: "accepted" },
        { changeId: "c2", filePath: "/app.ts", original: "x", modified: "y", status: "rejected" },
      ],
    });

    renderHook(() => useInlineDiff(mockEditor as never, "/app.ts"));

    expect(mockEditor.createDecorationsCollection).not.toHaveBeenCalled();
  });

  it("creates decorations for pending changes in active file", () => {
    useWorkspaceStore.setState({
      pendingChanges: [
        {
          changeId: "c1",
          filePath: "/app.ts",
          original: "line1\nold\nline3",
          modified: "line1\nnew\nline3",
          status: "pending",
        },
      ],
    });

    renderHook(() => useInlineDiff(mockEditor as never, "/app.ts"));

    expect(mockEditor.createDecorationsCollection).toHaveBeenCalledOnce();
    const decorations = mockEditor.createDecorationsCollection.mock.calls[0][0];
    expect(decorations).toHaveLength(1);

    // Should highlight line 2 (1-indexed)
    expect(decorations[0].range.startLineNumber).toBe(2);
    expect(decorations[0].range.endLineNumber).toBe(2);
    expect(decorations[0].options.className).toBe("inline-diff-modified-line");
    expect(decorations[0].options.glyphMarginClassName).toBe("inline-diff-glyph");
  });

  it("creates decorations spanning multiple changed lines", () => {
    useWorkspaceStore.setState({
      pendingChanges: [
        {
          changeId: "c1",
          filePath: "/app.ts",
          original: "line1\nold1\nold2\nline4",
          modified: "line1\nnew1\nnew2\nline4",
          status: "pending",
        },
      ],
    });

    renderHook(() => useInlineDiff(mockEditor as never, "/app.ts"));

    const decorations = mockEditor.createDecorationsCollection.mock.calls[0][0];
    expect(decorations[0].range.startLineNumber).toBe(2);
    expect(decorations[0].range.endLineNumber).toBe(3);
  });

  it("clears decorations on unmount", () => {
    useWorkspaceStore.setState({
      pendingChanges: [
        {
          changeId: "c1",
          filePath: "/app.ts",
          original: "old",
          modified: "new",
          status: "pending",
        },
      ],
    });

    const { unmount } = renderHook(() => useInlineDiff(mockEditor as never, "/app.ts"));

    unmount();

    expect(mockEditor._mockCollection.clear).toHaveBeenCalled();
  });

  it("clears old decorations when pendingChanges update", () => {
    const change1: CodeChange = {
      changeId: "c1",
      filePath: "/app.ts",
      original: "old",
      modified: "new",
      status: "pending",
    };

    useWorkspaceStore.setState({ pendingChanges: [change1] });

    const { rerender } = renderHook(() => useInlineDiff(mockEditor as never, "/app.ts"));

    // Clear the old collection on re-render
    useWorkspaceStore.setState({ pendingChanges: [] });
    rerender();

    expect(mockEditor._mockCollection.clear).toHaveBeenCalled();
  });

  it("handles model being null", () => {
    mockEditor.getModel.mockReturnValue(null);

    useWorkspaceStore.setState({
      pendingChanges: [
        { changeId: "c1", filePath: "/app.ts", original: "a", modified: "b", status: "pending" },
      ],
    });

    // Should not throw
    renderHook(() => useInlineDiff(mockEditor as never, "/app.ts"));

    expect(mockEditor.createDecorationsCollection).not.toHaveBeenCalled();
  });
});
