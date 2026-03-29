"use client";

import { useCallback, useEffect, useRef } from "react";
import { useWorkspaceStore } from "@/stores/workspace";
import { getRpcClient } from "@/lib/rpc/client";
import type { ChatContext } from "@/lib/rpc/types";
import { ChatMessageComponent } from "./ChatMessage";
import { ChatInput } from "./ChatInput";

export function ChatPanel() {
  const chatId = useWorkspaceStore((s) => s.chatId);
  const messages = useWorkspaceStore((s) => s.chatMessages);
  const chatStatus = useWorkspaceStore((s) => s.chatStatus);
  const pendingChanges = useWorkspaceStore((s) => s.pendingChanges);
  const activeTab = useWorkspaceStore((s) => s.activeTab);
  const openFiles = useWorkspaceStore((s) => s.openFiles);
  const cursorPosition = useWorkspaceStore((s) => s.cursorPosition);
  const tabOrder = useWorkspaceStore((s) => s.tabOrder);
  const gitStatus = useWorkspaceStore((s) => s.gitStatus);

  const addUserMessage = useWorkspaceStore((s) => s.addUserMessage);
  const addAssistantMessage = useWorkspaceStore((s) => s.addAssistantMessage);
  const setChatStatus = useWorkspaceStore((s) => s.setChatStatus);
  const acceptChange = useWorkspaceStore((s) => s.acceptChange);
  const rejectChange = useWorkspaceStore((s) => s.rejectChange);
  const acceptAllChanges = useWorkspaceStore((s) => s.acceptAllChanges);
  const rejectAllChanges = useWorkspaceStore((s) => s.rejectAllChanges);
  const clearChat = useWorkspaceStore((s) => s.clearChat);
  const updateContent = useWorkspaceStore((s) => s.updateContent);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Build context from current editor state
  const buildContext = useCallback((): ChatContext => {
    const ctx: ChatContext = {};

    if (activeTab) {
      const file = openFiles.get(activeTab);
      if (file) {
        ctx.activeFile = {
          path: file.path,
          content: file.content,
          language: file.language,
        };
      }
    }

    if (cursorPosition) {
      ctx.cursorPosition = cursorPosition;
    }

    if (tabOrder.length > 0) {
      ctx.openFiles = tabOrder;
    }

    const changedFiles = gitStatus.filter((s) => s.status !== "untracked").map((s) => s.path);
    if (changedFiles.length > 0) {
      ctx.gitChangedFiles = changedFiles;
    }

    return ctx;
  }, [activeTab, openFiles, cursorPosition, tabOrder, gitStatus]);

  const handleSend = useCallback(
    async (message: string) => {
      const userMsgId = crypto.randomUUID();
      addUserMessage(userMsgId, message);
      setChatStatus("sending");

      try {
        const context = buildContext();
        const client = getRpcClient();
        const { messageId } = await client.call("chat.send", {
          chatId,
          message,
          context,
        });

        // Assistant message will be populated via chat.stream notifications
        addAssistantMessage(messageId);
      } catch (err) {
        console.error("Failed to send chat message:", err);
        setChatStatus("error");
      }
    },
    [chatId, addUserMessage, addAssistantMessage, setChatStatus, buildContext]
  );

  const handleAbort = useCallback(async () => {
    try {
      const client = getRpcClient();
      await client.call("chat.abort", { chatId });
    } catch {
      // Silent
    }
  }, [chatId]);

  // Apply accepted changes to files
  const handleAcceptChange = useCallback(
    (changeId: string) => {
      const change = pendingChanges.find((c) => c.changeId === changeId);
      if (change) {
        updateContent(change.filePath, change.modified);
        acceptChange(changeId);
      }
    },
    [pendingChanges, updateContent, acceptChange]
  );

  const handleRejectChange = useCallback(
    (changeId: string) => {
      rejectChange(changeId);
    },
    [rejectChange]
  );

  const handleAcceptAll = useCallback(() => {
    for (const change of pendingChanges) {
      if (change.status === "pending") {
        updateContent(change.filePath, change.modified);
      }
    }
    acceptAllChanges();
  }, [pendingChanges, updateContent, acceptAllChanges]);

  const handleApplyCode = useCallback(
    (code: string) => {
      if (activeTab) {
        updateContent(activeTab, code);
      }
    },
    [activeTab, updateContent]
  );

  return (
    <div className="flex h-full flex-col bg-[#252526]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#3c3c3c] px-3 py-2">
        <span className="text-[12px] font-semibold text-[#cccccc]">AI Chat</span>
        <button
          type="button"
          className="rounded px-2 py-0.5 text-[11px] text-[#969696] hover:bg-[#3c3c3c] hover:text-white"
          onClick={clearChat}
          title="New Chat"
        >
          New Chat
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center p-4">
            <div className="text-center">
              <div className="mb-2 text-[32px]">
                <svg viewBox="0 0 24 24" className="mx-auto h-8 w-8 text-[#858585]" fill="currentColor">
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z" />
                </svg>
              </div>
              <p className="text-[13px] text-[#858585]">
                Ask AI to help with your code
              </p>
              <p className="mt-1 text-[11px] text-[#5a5a5a]">
                Context from your active file is shared automatically
              </p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <ChatMessageComponent
                key={msg.id}
                message={msg}
                pendingChanges={pendingChanges}
                onAcceptChange={handleAcceptChange}
                onRejectChange={handleRejectChange}
                onAcceptAll={handleAcceptAll}
                onRejectAll={rejectAllChanges}
                onApplyCode={handleApplyCode}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <ChatInput
        status={chatStatus}
        activeFilePath={activeTab}
        onSend={handleSend}
        onAbort={handleAbort}
      />
    </div>
  );
}
