import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChatMessageComponent } from "@/components/Editor/Chat/ChatMessage";
import type { ChatMessage, CodeChange } from "@/lib/rpc/types";

// Mock child components to isolate ChatMessage logic
vi.mock("@/components/Editor/Chat/CodeBlock", () => ({
  CodeBlock: ({ code, language }: { code: string; language?: string }) => (
    <div data-testid="code-block" data-language={language}>{code}</div>
  ),
}));

vi.mock("@/components/Editor/Chat/DiffProposal", () => ({
  DiffProposal: ({ changes }: { changes: CodeChange[] }) => (
    <div data-testid="diff-proposal">{changes.length} changes</div>
  ),
}));

describe("ChatMessageComponent", () => {
  const defaultHandlers = {
    onAcceptChange: vi.fn(),
    onRejectChange: vi.fn(),
    onAcceptAll: vi.fn(),
    onRejectAll: vi.fn(),
    onApplyCode: vi.fn(),
  };

  function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
    return {
      id: "msg-1",
      role: "user",
      content: "Hello",
      timestamp: new Date().toISOString(),
      ...overrides,
    };
  }

  it("renders user message with 'You' label", () => {
    render(
      <ChatMessageComponent
        message={makeMessage({ role: "user" })}
        pendingChanges={[]}
        {...defaultHandlers}
      />
    );

    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("renders assistant message with 'AI' label", () => {
    render(
      <ChatMessageComponent
        message={makeMessage({ role: "assistant", content: "I can help" })}
        pendingChanges={[]}
        {...defaultHandlers}
      />
    );

    expect(screen.getByText("AI")).toBeInTheDocument();
    expect(screen.getByText("I can help")).toBeInTheDocument();
  });

  it("parses and renders code blocks", () => {
    const content = "Here is code:\n```typescript\nconst x = 1;\n```\nDone.";
    render(
      <ChatMessageComponent
        message={makeMessage({ content })}
        pendingChanges={[]}
        {...defaultHandlers}
      />
    );

    expect(screen.getByTestId("code-block")).toBeInTheDocument();
    expect(screen.getByTestId("code-block")).toHaveTextContent("const x = 1;");
    expect(screen.getByTestId("code-block")).toHaveAttribute("data-language", "typescript");
  });

  it("renders inline code with backticks", () => {
    const content = "Use `console.log` for debugging";
    render(
      <ChatMessageComponent
        message={makeMessage({ content })}
        pendingChanges={[]}
        {...defaultHandlers}
      />
    );

    expect(screen.getByText("console.log")).toBeInTheDocument();
    // The inline code should be in a <code> element
    const codeEl = screen.getByText("console.log");
    expect(codeEl.tagName).toBe("CODE");
  });

  it("renders DiffProposal when message has codeChanges", () => {
    const codeChanges: CodeChange[] = [
      {
        changeId: "c1",
        filePath: "/src/app.ts",
        original: "old",
        modified: "new",
        status: "pending",
      },
    ];

    render(
      <ChatMessageComponent
        message={makeMessage({ role: "assistant", codeChanges })}
        pendingChanges={codeChanges}
        {...defaultHandlers}
      />
    );

    expect(screen.getByTestId("diff-proposal")).toBeInTheDocument();
    expect(screen.getByTestId("diff-proposal")).toHaveTextContent("1 changes");
  });

  it("does not render DiffProposal when no codeChanges", () => {
    render(
      <ChatMessageComponent
        message={makeMessage({ role: "assistant" })}
        pendingChanges={[]}
        {...defaultHandlers}
      />
    );

    expect(screen.queryByTestId("diff-proposal")).not.toBeInTheDocument();
  });

  it("uses pendingChanges status for DiffProposal changes", () => {
    const codeChanges: CodeChange[] = [
      { changeId: "c1", filePath: "/a.ts", original: "x", modified: "y", status: "pending" },
    ];
    const pendingChanges: CodeChange[] = [
      { changeId: "c1", filePath: "/a.ts", original: "x", modified: "y", status: "accepted" },
    ];

    render(
      <ChatMessageComponent
        message={makeMessage({ role: "assistant", codeChanges })}
        pendingChanges={pendingChanges}
        {...defaultHandlers}
      />
    );

    // DiffProposal should receive the updated pendingChanges version
    expect(screen.getByTestId("diff-proposal")).toBeInTheDocument();
  });

  it("handles multiple code blocks in content", () => {
    const content = "First:\n```js\nconst a = 1;\n```\nSecond:\n```py\nx = 2\n```";
    render(
      <ChatMessageComponent
        message={makeMessage({ content })}
        pendingChanges={[]}
        {...defaultHandlers}
      />
    );

    const codeBlocks = screen.getAllByTestId("code-block");
    expect(codeBlocks).toHaveLength(2);
  });

  it("renders plain text without code blocks", () => {
    render(
      <ChatMessageComponent
        message={makeMessage({ content: "Just plain text" })}
        pendingChanges={[]}
        {...defaultHandlers}
      />
    );

    expect(screen.getByText("Just plain text")).toBeInTheDocument();
    expect(screen.queryByTestId("code-block")).not.toBeInTheDocument();
  });
});
