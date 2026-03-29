"use client";

import { useCallback, useRef, useState, type KeyboardEvent } from "react";
import type { ChatStatus } from "@/lib/rpc/types";

interface ChatInputProps {
  status: ChatStatus;
  activeFilePath: string | null;
  onSend: (message: string) => void;
  onAbort: () => void;
}

export function ChatInput({ status, activeFilePath, onSend, onAbort }: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || status === "streaming" || status === "sending") return;
    onSend(trimmed);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [input, status, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleInput = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 150) + "px";
    }
  }, []);

  const isStreaming = status === "streaming" || status === "sending";

  return (
    <div className="border-t border-[#3c3c3c] bg-[#1e1e1e] p-3">
      {/* Context indicator */}
      {activeFilePath && (
        <div className="mb-2 flex items-center gap-1 text-[11px] text-[#858585]">
          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor">
            <path d="M13.85 4.44l-3.28-3.3-.35-.14H2.5l-.5.5v13l.5.5h11l.5-.5V4.8l-.15-.36zm-.85.86h-2.5V2.8L13 5.3zM3 14V2h6v4h4v8H3z" />
          </svg>
          <span className="truncate">{activeFilePath}</span>
        </div>
      )}

      {/* Input area */}
      <div className="flex gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder={isStreaming ? "AI is responding..." : "Ask AI about your code... (Enter to send)"}
          disabled={isStreaming}
          rows={1}
          className="flex-1 resize-none rounded border border-[#3c3c3c] bg-[#3c3c3c] px-3 py-2 text-[13px] text-[#cccccc] placeholder-[#858585] outline-none focus:border-[#007acc] disabled:opacity-50"
        />
        {isStreaming ? (
          <button
            type="button"
            className="shrink-0 rounded bg-[#c74e39] px-3 py-2 text-[12px] text-white hover:bg-[#d65f4a]"
            onClick={onAbort}
          >
            Stop
          </button>
        ) : (
          <button
            type="button"
            className="shrink-0 rounded bg-[#007acc] px-3 py-2 text-[12px] text-white hover:bg-[#0098ff] disabled:opacity-40"
            disabled={!input.trim()}
            onClick={handleSend}
          >
            Send
          </button>
        )}
      </div>

      {/* Status indicator */}
      {status === "error" && (
        <div className="mt-2 text-[11px] text-[#f85149]">
          An error occurred. Please try again.
        </div>
      )}
    </div>
  );
}
