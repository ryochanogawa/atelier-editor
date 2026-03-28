import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useWorkspaceStore } from "@/stores/workspace";

// Mock RPC client
const mockCall = vi.fn();
vi.mock("@/lib/rpc/client", () => ({
  getRpcClient: () => ({
    call: mockCall,
  }),
}));

function fireKey(key: string, opts: Partial<KeyboardEventInit> = {}) {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...opts,
  });
  window.dispatchEvent(event);
  return event;
}

describe("useKeyboardShortcuts", () => {
  beforeEach(() => {
    mockCall.mockReset();
  });

  // ── Cmd+S / Ctrl+S ──

  describe("save shortcut (Cmd+S)", () => {
    it("saves dirty file via RPC and marks saved", async () => {
      const openFiles = new Map([
        ["/a.ts", { path: "/a.ts", content: "modified", originalContent: "original", language: "typescript" }],
      ]);
      useWorkspaceStore.setState({ activeTab: "/a.ts", openFiles });
      mockCall.mockResolvedValue({ success: true });

      renderHook(() => useKeyboardShortcuts());

      fireKey("s", { metaKey: true });

      // Wait for async RPC call
      await vi.waitFor(() => {
        expect(mockCall).toHaveBeenCalledWith("fs.writeFile", {
          path: "/a.ts",
          content: "modified",
        });
      });

      // Check markSaved was called
      await vi.waitFor(() => {
        const file = useWorkspaceStore.getState().openFiles.get("/a.ts")!;
        expect(file.originalContent).toBe("modified");
      });
    });

    it("does not save when file is not dirty", () => {
      const openFiles = new Map([
        ["/a.ts", { path: "/a.ts", content: "same", originalContent: "same", language: "typescript" }],
      ]);
      useWorkspaceStore.setState({ activeTab: "/a.ts", openFiles });

      renderHook(() => useKeyboardShortcuts());
      fireKey("s", { metaKey: true });

      expect(mockCall).not.toHaveBeenCalled();
    });

    it("does not save when no active tab", () => {
      renderHook(() => useKeyboardShortcuts());
      fireKey("s", { metaKey: true });
      expect(mockCall).not.toHaveBeenCalled();
    });

    it("works with Ctrl+S", async () => {
      const openFiles = new Map([
        ["/a.ts", { path: "/a.ts", content: "modified", originalContent: "original", language: "typescript" }],
      ]);
      useWorkspaceStore.setState({ activeTab: "/a.ts", openFiles });
      mockCall.mockResolvedValue({ success: true });

      renderHook(() => useKeyboardShortcuts());
      fireKey("s", { ctrlKey: true });

      await vi.waitFor(() => {
        expect(mockCall).toHaveBeenCalled();
      });
    });

    it("handles save error gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const openFiles = new Map([
        ["/a.ts", { path: "/a.ts", content: "modified", originalContent: "original", language: "typescript" }],
      ]);
      useWorkspaceStore.setState({ activeTab: "/a.ts", openFiles });
      mockCall.mockRejectedValue(new Error("Network error"));

      renderHook(() => useKeyboardShortcuts());
      fireKey("s", { metaKey: true });

      await vi.waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith("Failed to save file:", expect.any(Error));
      });
      consoleSpy.mockRestore();
    });
  });

  // ── Cmd+W / Ctrl+W ──

  describe("close tab shortcut (Cmd+W)", () => {
    it("closes active tab", () => {
      const openFiles = new Map([
        ["/a.ts", { path: "/a.ts", content: "a", originalContent: "a", language: "typescript" }],
      ]);
      useWorkspaceStore.setState({
        activeTab: "/a.ts",
        openFiles,
        tabOrder: ["/a.ts"],
      });

      renderHook(() => useKeyboardShortcuts());
      fireKey("w", { metaKey: true });

      expect(useWorkspaceStore.getState().openFiles.has("/a.ts")).toBe(false);
      expect(useWorkspaceStore.getState().tabOrder).toEqual([]);
    });

    it("does nothing when no active tab", () => {
      renderHook(() => useKeyboardShortcuts());
      fireKey("w", { metaKey: true });
      // No error thrown
      expect(useWorkspaceStore.getState().tabOrder).toEqual([]);
    });
  });

  // ── Cleanup ──

  describe("cleanup", () => {
    it("removes event listener on unmount", () => {
      const { unmount } = renderHook(() => useKeyboardShortcuts());
      const openFiles = new Map([
        ["/a.ts", { path: "/a.ts", content: "modified", originalContent: "original", language: "typescript" }],
      ]);
      useWorkspaceStore.setState({ activeTab: "/a.ts", openFiles });

      unmount();
      fireKey("s", { metaKey: true });
      expect(mockCall).not.toHaveBeenCalled();
    });
  });
});
