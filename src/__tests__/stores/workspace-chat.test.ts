import { describe, it, expect } from "vitest";
import { useWorkspaceStore } from "@/stores/workspace";
import type { CodeChange } from "@/lib/rpc/types";

function getState() {
  return useWorkspaceStore.getState();
}

describe("ChatSlice", () => {
  // ── Initial State ──

  it("has initial idle status", () => {
    expect(getState().chatStatus).toBe("idle");
  });

  it("has empty messages initially", () => {
    expect(getState().chatMessages).toEqual([]);
  });

  it("has no streaming message initially", () => {
    expect(getState().streamingMessageId).toBeNull();
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
      expect(getState().streamingMessageId).toBe("asst-1");
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
    it("clears streaming state and sets status to idle", () => {
      getState().addAssistantMessage("asst-1");
      getState().appendStreamDelta("asst-1", "Done");
      getState().finalizeStream("asst-1");

      expect(getState().streamingMessageId).toBeNull();
      expect(getState().chatStatus).toBe("idle");
    });

    it("attaches codeChanges to the message", () => {
      const changes: CodeChange[] = [
        {
          changeId: "c1",
          filePath: "/src/app.ts",
          original: "const a = 1;",
          modified: "const a = 2;",
          status: "pending",
        },
      ];

      getState().addAssistantMessage("asst-1");
      getState().finalizeStream("asst-1", changes);

      const msg = getState().chatMessages.find((m) => m.id === "asst-1");
      expect(msg?.codeChanges).toEqual(changes);
    });

    it("appends codeChanges to pendingChanges", () => {
      const changes: CodeChange[] = [
        {
          changeId: "c1",
          filePath: "/src/app.ts",
          original: "old",
          modified: "new",
          status: "pending",
        },
        {
          changeId: "c2",
          filePath: "/src/lib.ts",
          original: "old2",
          modified: "new2",
          status: "pending",
        },
      ];

      getState().addAssistantMessage("asst-1");
      getState().finalizeStream("asst-1", changes);

      expect(getState().pendingChanges).toHaveLength(2);
      expect(getState().pendingChanges[0].changeId).toBe("c1");
      expect(getState().pendingChanges[1].changeId).toBe("c2");
    });

    it("preserves existing pendingChanges when finalizing without codeChanges", () => {
      // Setup existing pending changes
      const existing: CodeChange[] = [
        { changeId: "c0", filePath: "/a.ts", original: "x", modified: "y", status: "pending" },
      ];
      getState().addAssistantMessage("asst-0");
      getState().finalizeStream("asst-0", existing);

      // Finalize another without changes
      getState().addAssistantMessage("asst-1");
      getState().finalizeStream("asst-1");

      expect(getState().pendingChanges).toHaveLength(1);
      expect(getState().pendingChanges[0].changeId).toBe("c0");
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
      const changes: CodeChange[] = [
        { changeId: "c1", filePath: "/a.ts", original: "x", modified: "y", status: "pending" },
        { changeId: "c2", filePath: "/b.ts", original: "a", modified: "b", status: "pending" },
      ];
      getState().addAssistantMessage("asst-1");
      getState().finalizeStream("asst-1", changes);

      getState().acceptChange("c1");

      expect(getState().pendingChanges[0].status).toBe("accepted");
      expect(getState().pendingChanges[1].status).toBe("pending");
    });
  });

  describe("rejectChange", () => {
    it("marks a specific change as rejected", () => {
      const changes: CodeChange[] = [
        { changeId: "c1", filePath: "/a.ts", original: "x", modified: "y", status: "pending" },
      ];
      getState().addAssistantMessage("asst-1");
      getState().finalizeStream("asst-1", changes);

      getState().rejectChange("c1");

      expect(getState().pendingChanges[0].status).toBe("rejected");
    });
  });

  // ── acceptAllChanges / rejectAllChanges ──

  describe("acceptAllChanges", () => {
    it("accepts all pending changes", () => {
      const changes: CodeChange[] = [
        { changeId: "c1", filePath: "/a.ts", original: "x", modified: "y", status: "pending" },
        { changeId: "c2", filePath: "/b.ts", original: "a", modified: "b", status: "pending" },
      ];
      getState().addAssistantMessage("asst-1");
      getState().finalizeStream("asst-1", changes);

      getState().acceptAllChanges();

      expect(getState().pendingChanges.every((c) => c.status === "accepted")).toBe(true);
    });

    it("does not modify already accepted/rejected changes", () => {
      const changes: CodeChange[] = [
        { changeId: "c1", filePath: "/a.ts", original: "x", modified: "y", status: "pending" },
        { changeId: "c2", filePath: "/b.ts", original: "a", modified: "b", status: "pending" },
      ];
      getState().addAssistantMessage("asst-1");
      getState().finalizeStream("asst-1", changes);

      getState().rejectChange("c2");
      getState().acceptAllChanges();

      expect(getState().pendingChanges[0].status).toBe("accepted");
      expect(getState().pendingChanges[1].status).toBe("rejected");
    });
  });

  describe("rejectAllChanges", () => {
    it("rejects all pending changes", () => {
      const changes: CodeChange[] = [
        { changeId: "c1", filePath: "/a.ts", original: "x", modified: "y", status: "pending" },
        { changeId: "c2", filePath: "/b.ts", original: "a", modified: "b", status: "pending" },
      ];
      getState().addAssistantMessage("asst-1");
      getState().finalizeStream("asst-1", changes);

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
      expect(getState().streamingMessageId).toBeNull();
      expect(getState().pendingChanges).toEqual([]);
      expect(getState().chatId).not.toBe(oldChatId);
    });
  });
});
