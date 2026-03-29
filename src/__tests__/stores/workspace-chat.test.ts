import { describe, it, expect, beforeEach } from "vitest";
import { useWorkspaceStore } from "@/stores/workspace";
import type { CodeChange } from "@/lib/rpc/types";

function getState() {
  return useWorkspaceStore.getState();
}

describe("ChatSlice", () => {
  beforeEach(() => {
    getState().clearChat();
  });

  // ── Initial State ──

  it("has initial idle status", () => {
    expect(getState().chatStatus).toBe("idle");
  });

  it("has empty messages initially", () => {
    expect(getState().chatMessages).toEqual([]);
  });

  it("has empty pending changes initially", () => {
    expect(getState().pendingChanges).toEqual([]);
  });

  it("has a chatId (UUID)", () => {
    expect(getState().chatId).toBeTruthy();
    expect(typeof getState().chatId).toBe("string");
  });

  // ── addUserMessage ──

  describe("addUserMessage", () => {
    it("adds a user message to chatMessages", () => {
      getState().addUserMessage("msg-1", "Hello AI");

      const msgs = getState().chatMessages;
      expect(msgs).toHaveLength(1);
      expect(msgs[0]).toMatchObject({
        id: "msg-1",
        role: "user",
        content: "Hello AI",
      });
      expect(msgs[0].timestamp).toBeTruthy();
    });

    it("appends multiple messages in order", () => {
      getState().addUserMessage("msg-1", "First");
      getState().addUserMessage("msg-2", "Second");

      const msgs = getState().chatMessages;
      expect(msgs).toHaveLength(2);
      expect(msgs[0].content).toBe("First");
      expect(msgs[1].content).toBe("Second");
    });
  });

  // ── addAssistantMessage ──

  describe("addAssistantMessage", () => {
    it("adds an empty assistant message and sets streaming state", () => {
      getState().addAssistantMessage("asst-1");

      const msgs = getState().chatMessages;
      expect(msgs).toHaveLength(1);
      expect(msgs[0]).toMatchObject({
        id: "asst-1",
        role: "assistant",
        content: "",
      });
      expect(getState().chatStatus).toBe("streaming");
    });
  });

  // ── appendStreamDelta ──

  describe("appendStreamDelta", () => {
    it("appends delta to the correct message", () => {
      getState().addAssistantMessage("asst-1");
      getState().appendStreamDelta("asst-1", "Hello ");
      getState().appendStreamDelta("asst-1", "World");

      const msg = getState().chatMessages.find((m) => m.id === "asst-1");
      expect(msg?.content).toBe("Hello World");
    });

    it("does not modify other messages", () => {
      getState().addUserMessage("user-1", "Question");
      getState().addAssistantMessage("asst-1");
      getState().appendStreamDelta("asst-1", "Answer");

      expect(getState().chatMessages[0].content).toBe("Question");
      expect(getState().chatMessages[1].content).toBe("Answer");
    });
  });

  // ── finalizeStream ──

  describe("finalizeStream", () => {
    it("sets status to idle", () => {
      getState().addAssistantMessage("asst-1");
      getState().appendStreamDelta("asst-1", "Done");
      getState().finalizeStream("asst-1");

      expect(getState().chatStatus).toBe("idle");
    });
  });

  // ── addCodeChange ──

  describe("addCodeChange", () => {
    it("attaches codeChanges to the message and pendingChanges", () => {
      const change: CodeChange = {
        changeId: "c1",
        filePath: "/src/app.ts",
        original: "const a = 1;",
        modified: "const a = 2;",
        status: "pending",
      };

      getState().addAssistantMessage("asst-1");
      getState().addCodeChange("asst-1", change);

      const msg = getState().chatMessages.find((m) => m.id === "asst-1");
      expect(msg?.codeChanges).toEqual([change]);
      expect(getState().pendingChanges).toHaveLength(1);
      expect(getState().pendingChanges[0].changeId).toBe("c1");
    });

    it("appends multiple code changes", () => {
      getState().addAssistantMessage("asst-1");
      getState().addCodeChange("asst-1", {
        changeId: "c1", filePath: "/a.ts", original: "x", modified: "y", status: "pending",
      });
      getState().addCodeChange("asst-1", {
        changeId: "c2", filePath: "/b.ts", original: "a", modified: "b", status: "pending",
      });

      expect(getState().pendingChanges).toHaveLength(2);
      const msg = getState().chatMessages.find((m) => m.id === "asst-1");
      expect(msg?.codeChanges).toHaveLength(2);
    });
  });

  // ── setChatStatus ──

  describe("setChatStatus", () => {
    it("updates chat status", () => {
      getState().setChatStatus("error");
      expect(getState().chatStatus).toBe("error");

      getState().setChatStatus("sending");
      expect(getState().chatStatus).toBe("sending");
    });
  });

  // ── acceptChange / rejectChange ──

  describe("acceptChange", () => {
    it("marks a specific change as accepted", () => {
      getState().addAssistantMessage("asst-1");
      getState().addCodeChange("asst-1", {
        changeId: "c1", filePath: "/a.ts", original: "x", modified: "y", status: "pending",
      });
      getState().addCodeChange("asst-1", {
        changeId: "c2", filePath: "/b.ts", original: "a", modified: "b", status: "pending",
      });

      getState().acceptChange("c1");

      expect(getState().pendingChanges[0].status).toBe("accepted");
      expect(getState().pendingChanges[1].status).toBe("pending");
    });
  });

  describe("rejectChange", () => {
    it("marks a specific change as rejected", () => {
      getState().addAssistantMessage("asst-1");
      getState().addCodeChange("asst-1", {
        changeId: "c1", filePath: "/a.ts", original: "x", modified: "y", status: "pending",
      });

      getState().rejectChange("c1");

      expect(getState().pendingChanges[0].status).toBe("rejected");
    });
  });

  // ── acceptAllChanges / rejectAllChanges ──

  describe("acceptAllChanges", () => {
    it("accepts all pending changes", () => {
      getState().addAssistantMessage("asst-1");
      getState().addCodeChange("asst-1", {
        changeId: "c1", filePath: "/a.ts", original: "x", modified: "y", status: "pending",
      });
      getState().addCodeChange("asst-1", {
        changeId: "c2", filePath: "/b.ts", original: "a", modified: "b", status: "pending",
      });

      getState().acceptAllChanges();

      expect(getState().pendingChanges.every((c) => c.status === "accepted")).toBe(true);
    });

    it("does not modify already accepted/rejected changes", () => {
      getState().addAssistantMessage("asst-1");
      getState().addCodeChange("asst-1", {
        changeId: "c1", filePath: "/a.ts", original: "x", modified: "y", status: "pending",
      });
      getState().addCodeChange("asst-1", {
        changeId: "c2", filePath: "/b.ts", original: "a", modified: "b", status: "pending",
      });

      getState().rejectChange("c2");
      getState().acceptAllChanges();

      expect(getState().pendingChanges[0].status).toBe("accepted");
      expect(getState().pendingChanges[1].status).toBe("rejected");
    });
  });

  describe("rejectAllChanges", () => {
    it("rejects all pending changes", () => {
      getState().addAssistantMessage("asst-1");
      getState().addCodeChange("asst-1", {
        changeId: "c1", filePath: "/a.ts", original: "x", modified: "y", status: "pending",
      });
      getState().addCodeChange("asst-1", {
        changeId: "c2", filePath: "/b.ts", original: "a", modified: "b", status: "pending",
      });

      getState().rejectAllChanges();

      expect(getState().pendingChanges.every((c) => c.status === "rejected")).toBe(true);
    });
  });

  // ── clearChat ──

  describe("clearChat", () => {
    it("resets all chat state", () => {
      const oldChatId = getState().chatId;

      getState().addUserMessage("msg-1", "Hello");
      getState().addAssistantMessage("asst-1");
      getState().setChatStatus("streaming");

      getState().clearChat();

      expect(getState().chatMessages).toEqual([]);
      expect(getState().chatStatus).toBe("idle");
      expect(getState().pendingChanges).toEqual([]);
      expect(getState().chatId).not.toBe(oldChatId);
    });
  });
});
