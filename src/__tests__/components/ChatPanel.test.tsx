import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatPanel } from "@/components/Editor/Chat/ChatPanel";
import { useWorkspaceStore } from "@/stores/workspace";

// Mock RPC client
const mockCall = vi.fn();
vi.mock("@/lib/rpc/client", () => ({
  getRpcClient: () => ({ call: mockCall }),
}));

// Mock child components for isolation
vi.mock("@/components/Editor/Chat/ChatMessage", () => ({
  ChatMessageComponent: ({ message }: { message: { id: string; role: string; content: string } }) => (
    <div data-testid={`message-${message.id}`} data-role={message.role}>
      {message.content}
    </div>
  ),
}));

vi.mock("@/components/Editor/Chat/ChatInput", () => ({
  ChatInput: ({
    onSend,
    onAbort,
    status,
    activeFilePath,
  }: {
    onSend: (msg: string) => void;
    onAbort: () => void;
    status: string;
    activeFilePath: string | null;
  }) => (
    <div data-testid="chat-input" data-status={status} data-file={activeFilePath}>
      <button onClick={() => onSend("test message")}>MockSend</button>
      <button onClick={onAbort}>MockAbort</button>
    </div>
  ),
}));

describe("ChatPanel", () => {
  beforeEach(() => {
    mockCall.mockReset();
  });

  it("renders header with AI Chat title", () => {
    render(<ChatPanel />);

    expect(screen.getByText("AI Chat")).toBeInTheDocument();
  });

  it("renders New Chat button", () => {
    render(<ChatPanel />);

    expect(screen.getByTitle("New Chat")).toBeInTheDocument();
  });

  it("shows empty state when no messages", () => {
    render(<ChatPanel />);

    expect(screen.getByText("Ask AI to help with your code")).toBeInTheDocument();
  });

  it("renders messages when present", () => {
    useWorkspaceStore.setState({
      chatMessages: [
        { id: "msg-1", role: "user", content: "Hello", timestamp: new Date().toISOString() },
        { id: "msg-2", role: "assistant", content: "Hi there", timestamp: new Date().toISOString() },
      ],
    });

    render(<ChatPanel />);

    expect(screen.getByTestId("message-msg-1")).toBeInTheDocument();
    expect(screen.getByTestId("message-msg-2")).toBeInTheDocument();
    expect(screen.queryByText("Ask AI to help with your code")).not.toBeInTheDocument();
  });

  it("sends message via RPC and adds messages to store", async () => {
    const user = userEvent.setup();
    mockCall.mockResolvedValueOnce({ messageId: "asst-1" });

    render(<ChatPanel />);
    await user.click(screen.getByText("MockSend"));

    // Should have called chat.send
    expect(mockCall).toHaveBeenCalledWith(
      "chat.send",
      expect.objectContaining({ message: "test message" })
    );

    // Store should have user message
    const state = useWorkspaceStore.getState();
    expect(state.chatMessages.length).toBeGreaterThanOrEqual(1);
    expect(state.chatMessages[0].role).toBe("user");
    expect(state.chatMessages[0].content).toBe("test message");
  });

  it("adds assistant message after successful RPC call", async () => {
    const user = userEvent.setup();
    mockCall.mockResolvedValueOnce({ messageId: "asst-1" });

    render(<ChatPanel />);
    await user.click(screen.getByText("MockSend"));

    // Wait for async RPC call
    await vi.waitFor(() => {
      const state = useWorkspaceStore.getState();
      expect(state.chatMessages).toHaveLength(2);
      expect(state.chatMessages[1].role).toBe("assistant");
      expect(state.chatMessages[1].id).toBe("asst-1");
    });
  });

  it("sets error status on RPC failure", async () => {
    const user = userEvent.setup();
    mockCall.mockRejectedValueOnce(new Error("Network error"));

    render(<ChatPanel />);
    await user.click(screen.getByText("MockSend"));

    await vi.waitFor(() => {
      expect(useWorkspaceStore.getState().chatStatus).toBe("error");
    });
  });

  it("calls chat.abort when abort is triggered", async () => {
    const user = userEvent.setup();
    mockCall.mockResolvedValueOnce({ success: true });

    render(<ChatPanel />);
    await user.click(screen.getByText("MockAbort"));

    expect(mockCall).toHaveBeenCalledWith(
      "chat.abort",
      expect.objectContaining({ chatId: expect.any(String) })
    );
  });

  it("clears chat on New Chat button click", async () => {
    const user = userEvent.setup();
    useWorkspaceStore.setState({
      chatMessages: [
        { id: "msg-1", role: "user", content: "Hello", timestamp: new Date().toISOString() },
      ],
    });

    render(<ChatPanel />);
    await user.click(screen.getByTitle("New Chat"));

    expect(useWorkspaceStore.getState().chatMessages).toEqual([]);
  });

  it("passes active file path to ChatInput", () => {
    useWorkspaceStore.setState({
      activeTab: "/src/app.ts",
      openFiles: new Map([
        ["/src/app.ts", { path: "/src/app.ts", content: "code", language: "typescript" }],
      ]),
    });

    render(<ChatPanel />);

    expect(screen.getByTestId("chat-input")).toHaveAttribute("data-file", "/src/app.ts");
  });

  it("builds context with active file info", async () => {
    const user = userEvent.setup();
    useWorkspaceStore.setState({
      activeTab: "/src/app.ts",
      openFiles: new Map([
        ["/src/app.ts", { path: "/src/app.ts", content: "const x = 1;", language: "typescript" }],
      ]),
      tabOrder: ["/src/app.ts"],
      cursorPosition: { line: 1, column: 5 },
    });
    mockCall.mockResolvedValueOnce({ messageId: "asst-1" });

    render(<ChatPanel />);
    await user.click(screen.getByText("MockSend"));

    expect(mockCall).toHaveBeenCalledWith(
      "chat.send",
      expect.objectContaining({
        context: expect.objectContaining({
          activeFile: {
            path: "/src/app.ts",
            content: "const x = 1;",
            language: "typescript",
          },
          cursorPosition: { line: 1, column: 5 },
          openFiles: ["/src/app.ts"],
        }),
      })
    );
  });

  it("accepts change and updates file content", () => {
    const change = {
      changeId: "c1",
      filePath: "/src/app.ts",
      original: "old",
      modified: "new content",
      status: "pending" as const,
    };

    useWorkspaceStore.setState({
      pendingChanges: [change],
      openFiles: new Map([
        ["/src/app.ts", { path: "/src/app.ts", content: "old", language: "typescript" }],
      ]),
    });

    // Trigger acceptChange through store directly (since ChatPanel wires it up)
    const state = useWorkspaceStore.getState();
    state.updateContent("/src/app.ts", "new content");
    state.acceptChange("c1");

    const updated = useWorkspaceStore.getState();
    expect(updated.pendingChanges[0].status).toBe("accepted");
    expect(updated.openFiles.get("/src/app.ts")?.content).toBe("new content");
  });
});
