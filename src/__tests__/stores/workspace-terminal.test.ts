import { describe, it, expect } from "vitest";
import { useWorkspaceStore } from "@/stores/workspace";

function getState() {
  return useWorkspaceStore.getState();
}

describe("workspace store – Terminal Slice", () => {
  // ── Initial state ──

  it("initial terminal state", () => {
    expect(getState().terminalSessions).toEqual([]);
    expect(getState().activeTerminalId).toBeNull();
    expect(getState().terminalVisible).toBe(false);
    expect(getState().terminalHeight).toBe(256);
  });

  // ── addTerminalSession ──

  describe("addTerminalSession", () => {
    it("adds a session and makes it active and visible", () => {
      getState().addTerminalSession("sess-1");

      expect(getState().terminalSessions).toEqual([
        { sessionId: "sess-1", active: true },
      ]);
      expect(getState().activeTerminalId).toBe("sess-1");
      expect(getState().terminalVisible).toBe(true);
    });

    it("adds multiple sessions, latest becomes active", () => {
      getState().addTerminalSession("sess-1");
      getState().addTerminalSession("sess-2");

      expect(getState().terminalSessions).toHaveLength(2);
      expect(getState().activeTerminalId).toBe("sess-2");
    });
  });

  // ── removeTerminalSession ──

  describe("removeTerminalSession", () => {
    it("removes a session and activates the last remaining", () => {
      getState().addTerminalSession("sess-1");
      getState().addTerminalSession("sess-2");
      getState().setActiveTerminalId("sess-1");

      getState().removeTerminalSession("sess-1");

      expect(getState().terminalSessions).toHaveLength(1);
      expect(getState().activeTerminalId).toBe("sess-2");
    });

    it("hides terminal when last session is removed", () => {
      getState().addTerminalSession("sess-1");
      expect(getState().terminalVisible).toBe(true);

      getState().removeTerminalSession("sess-1");

      expect(getState().terminalSessions).toEqual([]);
      expect(getState().activeTerminalId).toBeNull();
      expect(getState().terminalVisible).toBe(false);
    });

    it("keeps activeTerminalId if removed session is not active", () => {
      getState().addTerminalSession("sess-1");
      getState().addTerminalSession("sess-2");
      // sess-2 is active

      getState().removeTerminalSession("sess-1");

      expect(getState().activeTerminalId).toBe("sess-2");
    });
  });

  // ── setActiveTerminalId ──

  it("setActiveTerminalId changes active terminal", () => {
    getState().addTerminalSession("sess-1");
    getState().addTerminalSession("sess-2");

    getState().setActiveTerminalId("sess-1");
    expect(getState().activeTerminalId).toBe("sess-1");
  });

  // ── setTerminalVisible ──

  it("setTerminalVisible sets visibility", () => {
    getState().setTerminalVisible(true);
    expect(getState().terminalVisible).toBe(true);

    getState().setTerminalVisible(false);
    expect(getState().terminalVisible).toBe(false);
  });

  // ── toggleTerminal ──

  describe("toggleTerminal", () => {
    it("toggles terminal visibility from false to true", () => {
      expect(getState().terminalVisible).toBe(false);
      getState().toggleTerminal();
      expect(getState().terminalVisible).toBe(true);
    });

    it("toggles terminal visibility from true to false", () => {
      getState().setTerminalVisible(true);
      getState().toggleTerminal();
      expect(getState().terminalVisible).toBe(false);
    });
  });

  // ── markTerminalExited ──

  describe("markTerminalExited", () => {
    it("marks a session as inactive (exited)", () => {
      getState().addTerminalSession("sess-1");
      getState().addTerminalSession("sess-2");

      getState().markTerminalExited("sess-1");

      const sess1 = getState().terminalSessions.find(
        (s) => s.sessionId === "sess-1"
      );
      const sess2 = getState().terminalSessions.find(
        (s) => s.sessionId === "sess-2"
      );

      expect(sess1?.active).toBe(false);
      expect(sess2?.active).toBe(true);
    });

    it("does not affect other sessions", () => {
      getState().addTerminalSession("sess-1");
      getState().markTerminalExited("sess-1");

      expect(getState().terminalSessions).toHaveLength(1);
      expect(getState().activeTerminalId).toBe("sess-1");
    });
  });

  // ── setTerminalHeight ──

  describe("setTerminalHeight", () => {
    it("updates terminal height", () => {
      getState().setTerminalHeight(400);
      expect(getState().terminalHeight).toBe(400);
    });

    it("accepts minimum height", () => {
      getState().setTerminalHeight(100);
      expect(getState().terminalHeight).toBe(100);
    });
  });
});
