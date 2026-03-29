import { describe, it, expect, vi, afterEach } from "vitest";
import { useWorkspaceStore } from "@/stores/workspace";
import type { FileContent } from "@/lib/rpc/types";

function getState() {
  return useWorkspaceStore.getState();
}

describe("workspace store – edge cases", () => {
  // ── closeFile tab navigation ──

  describe("closeFile tab navigation", () => {
    const fileA: FileContent = { path: "/a.ts", content: "a", encoding: "utf-8", language: "typescript" };
    const fileB: FileContent = { path: "/b.ts", content: "b", encoding: "utf-8", language: "typescript" };
    const fileC: FileContent = { path: "/c.ts", content: "c", encoding: "utf-8", language: "typescript" };

    it("activates first remaining tab when closing active middle tab", () => {
      // closeFile uses tabOrder[0], unlike removeTab which uses previous
      getState().openFile(fileA);
      getState().addTab(fileA.path);
      getState().openFile(fileB);
      getState().addTab(fileB.path);
      getState().openFile(fileC);
      getState().addTab(fileC.path);
      getState().setActiveTab("/b.ts");

      getState().closeFile("/b.ts");

      expect(getState().activeTab).toBe("/a.ts");
      expect(getState().tabOrder).toEqual(["/a.ts", "/c.ts"]);
      expect(getState().openFiles.has("/b.ts")).toBe(false);
    });

    it("activates first remaining tab when closing active first tab", () => {
      getState().openFile(fileA);
      getState().addTab(fileA.path);
      getState().openFile(fileB);
      getState().addTab(fileB.path);
      getState().openFile(fileC);
      getState().addTab(fileC.path);
      getState().setActiveTab("/a.ts");

      getState().closeFile("/a.ts");

      expect(getState().activeTab).toBe("/b.ts");
      expect(getState().tabOrder).toEqual(["/b.ts", "/c.ts"]);
    });

    it("does not change activeTab when closing a non-active tab", () => {
      getState().openFile(fileA);
      getState().addTab(fileA.path);
      getState().openFile(fileB);
      getState().addTab(fileB.path);
      getState().setActiveTab("/a.ts");

      getState().closeFile("/b.ts");

      expect(getState().activeTab).toBe("/a.ts");
      expect(getState().tabOrder).toEqual(["/a.ts"]);
    });
  });

  // ── removeTab vs closeFile behavior difference ──

  describe("removeTab selects previous tab (not first)", () => {
    it("activates previous tab when removing active middle tab", () => {
      getState().addTab("/a.ts");
      getState().addTab("/b.ts");
      getState().addTab("/c.ts");
      getState().setActiveTab("/c.ts");

      getState().removeTab("/c.ts");

      // removeTab goes to index Math.max(0, indexOf(path) - 1) = index 1 = "/b.ts"
      expect(getState().activeTab).toBe("/b.ts");
    });

    it("activates first tab when removing active first tab", () => {
      getState().addTab("/a.ts");
      getState().addTab("/b.ts");
      getState().setActiveTab("/a.ts");

      getState().removeTab("/a.ts");

      // Math.max(0, 0 - 1) = 0, tabOrder[0] = "/b.ts"
      expect(getState().activeTab).toBe("/b.ts");
    });

    it("does not change activeTab when removing non-active tab", () => {
      getState().addTab("/a.ts");
      getState().addTab("/b.ts");
      getState().addTab("/c.ts");
      // activeTab = "/c.ts" (last added)

      getState().removeTab("/a.ts");

      expect(getState().activeTab).toBe("/c.ts");
      expect(getState().tabOrder).toEqual(["/b.ts", "/c.ts"]);
    });
  });

  // ── Commission progress=0 ──

  describe("CommissionSlice progress edge cases", () => {
    it("addCommissionLog with progress=0 sets commissionProgress to 0 (not null)", () => {
      getState().addCommissionLog({
        phase: "init",
        message: "Starting",
        progress: 0,
        timestamp: "2026-01-01T00:00:00Z",
      });

      // progress=0 is falsy but valid; ?? operator should treat it correctly
      expect(getState().commissionProgress).toBe(0);
    });

    it("progress=0 overwrites previous non-null progress", () => {
      getState().addCommissionLog({
        phase: "build",
        message: "Building",
        progress: 50,
        timestamp: "2026-01-01T00:00:00Z",
      });
      getState().addCommissionLog({
        phase: "reset",
        message: "Restarting",
        progress: 0,
        timestamp: "2026-01-01T00:00:01Z",
      });

      expect(getState().commissionProgress).toBe(0);
    });

    it("startCommission clears previous result from completed commission", () => {
      getState().startCommission("c-1");
      getState().completeCommission({
        status: "success",
        changedFiles: ["a.ts"],
        summary: "Done",
      });

      expect(getState().commissionResult).not.toBeNull();

      getState().startCommission("c-2");

      expect(getState().commissionResult).toBeNull();
      expect(getState().activeCommissionId).toBe("c-2");
    });

    it("completeCommission with failure but no error field", () => {
      getState().startCommission("c-1");
      getState().completeCommission({ status: "failure" });

      expect(getState().commissionStatus).toBe("failed");
      expect(getState().commissionResult?.error).toBeUndefined();
    });
  });

  // ── Toast auto-dismiss timing ──

  describe("ToastSlice edge cases", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("toast is still visible before 4 seconds", () => {
      vi.useFakeTimers();
      getState().addToast("Temp", "info");

      vi.advanceTimersByTime(3999);
      expect(getState().toasts).toHaveLength(1);

      vi.advanceTimersByTime(1);
      expect(getState().toasts).toHaveLength(0);
      vi.useRealTimers();
    });

    it("multiple toasts auto-dismiss independently", () => {
      vi.useFakeTimers();
      getState().addToast("First", "info");

      vi.advanceTimersByTime(2000);
      getState().addToast("Second", "error");

      // At t=4000, first toast should be gone
      vi.advanceTimersByTime(2000);
      expect(getState().toasts).toHaveLength(1);
      expect(getState().toasts[0].message).toBe("Second");

      // At t=6000, second toast should also be gone
      vi.advanceTimersByTime(2000);
      expect(getState().toasts).toHaveLength(0);
      vi.useRealTimers();
    });
  });

  // ── Preview log boundary ──

  describe("PreviewSlice log boundary", () => {
    it("exactly 500 logs are kept without trimming", () => {
      for (let i = 0; i < 500; i++) {
        getState().addPreviewLog(`line-${i}`);
      }

      expect(getState().previewLogs).toHaveLength(500);
      expect(getState().previewLogs[0]).toBe("line-0");
      expect(getState().previewLogs[499]).toBe("line-499");
    });

    it("501st log triggers trimming to 500", () => {
      for (let i = 0; i < 501; i++) {
        getState().addPreviewLog(`line-${i}`);
      }

      expect(getState().previewLogs).toHaveLength(500);
      expect(getState().previewLogs[0]).toBe("line-1");
    });
  });

  // ── Git setBranches currentBranch derivation ──

  describe("GitSlice edge cases", () => {
    it("setBranches with multiple current branches picks first", () => {
      getState().setBranches([
        { name: "main", current: true },
        { name: "also-current", current: true },
      ]);

      // Array.find returns first match
      expect(getState().currentBranch?.name).toBe("main");
    });

    it("setBranches with empty array clears currentBranch", () => {
      getState().setBranches([{ name: "main", current: true }]);
      expect(getState().currentBranch).not.toBeNull();

      getState().setBranches([]);
      expect(getState().currentBranch).toBeNull();
      expect(getState().branches).toEqual([]);
    });
  });

  // ── Terminal session edge cases ──

  describe("TerminalSlice edge cases", () => {
    it("markTerminalExited does not affect activeTerminalId", () => {
      getState().addTerminalSession("sess-1");
      getState().addTerminalSession("sess-2");
      // sess-2 is active

      getState().markTerminalExited("sess-2");

      // Exiting doesn't change active - session remains selectable even after exit
      expect(getState().activeTerminalId).toBe("sess-2");
      expect(getState().terminalSessions.find((s) => s.sessionId === "sess-2")?.active).toBe(false);
    });

    it("setActiveTerminalId can be set to null", () => {
      getState().addTerminalSession("sess-1");
      getState().setActiveTerminalId(null);

      expect(getState().activeTerminalId).toBeNull();
    });
  });

  // ── ChatSlice edge cases ──

  describe("ChatSlice edge cases", () => {
    it("appendStreamDelta on non-existent messageId is no-op", () => {
      getState().addAssistantMessage("asst-1");
      getState().appendStreamDelta("non-existent", "data");

      const msg = getState().chatMessages.find((m) => m.id === "asst-1");
      expect(msg?.content).toBe("");
    });

    it("finalizeStream on non-existent messageId still clears streaming state", () => {
      getState().addAssistantMessage("asst-1");
      getState().finalizeStream("non-existent");

      expect(getState().streamingMessageId).toBeNull();
      expect(getState().chatStatus).toBe("idle");
    });

    it("clearChat generates a new chatId each time", () => {
      const id1 = getState().chatId;
      getState().clearChat();
      const id2 = getState().chatId;
      getState().clearChat();
      const id3 = getState().chatId;

      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
    });

    it("acceptChange on non-existent changeId is no-op", () => {
      getState().acceptChange("non-existent");
      expect(getState().pendingChanges).toEqual([]);
    });
  });

  // ── reloadFile edge: dirty check ──

  describe("reloadFile dirty detection", () => {
    it("reloads when content matches original (clean file)", () => {
      const file: FileContent = {
        path: "/test.ts",
        content: "original",
        encoding: "utf-8",
        language: "typescript",
      };
      getState().openFile(file);
      getState().reloadFile("/test.ts", "new from disk");

      expect(getState().openFiles.get("/test.ts")!.content).toBe("new from disk");
      expect(getState().openFiles.get("/test.ts")!.originalContent).toBe("new from disk");
    });

    it("does not reload when content differs from original (dirty file)", () => {
      const file: FileContent = {
        path: "/test.ts",
        content: "original",
        encoding: "utf-8",
        language: "typescript",
      };
      getState().openFile(file);
      getState().updateContent("/test.ts", "user edits");
      getState().reloadFile("/test.ts", "new from disk");

      expect(getState().openFiles.get("/test.ts")!.content).toBe("user edits");
      expect(getState().openFiles.get("/test.ts")!.originalContent).toBe("original");
    });
  });
});
