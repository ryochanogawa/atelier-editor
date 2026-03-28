"use client";

import { useState, useCallback, type KeyboardEvent } from "react";

interface CommitFormProps {
  onCommit: (message: string) => void;
  disabled: boolean;
}

export function CommitForm({ onCommit, disabled }: CommitFormProps) {
  const [message, setMessage] = useState("");

  const handleCommit = useCallback(() => {
    const trimmed = message.trim();
    if (!trimmed) return;
    onCommit(trimmed);
    setMessage("");
  }, [message, onCommit]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleCommit();
      }
    },
    [handleCommit]
  );

  return (
    <div className="border-t border-[#3c3c3c] px-3 py-2">
      <textarea
        className="w-full resize-none rounded border border-[#3c3c3c] bg-[#3c3c3c] px-2 py-1 text-[12px] text-[#cccccc] placeholder-[#858585] focus:border-[#007acc] focus:outline-none"
        placeholder="Commit message"
        rows={3}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <button
        type="button"
        className="mt-1 w-full rounded bg-[#007acc] px-3 py-1 text-[12px] text-white hover:bg-[#0062a3] disabled:opacity-40 disabled:cursor-not-allowed"
        onClick={handleCommit}
        disabled={disabled || !message.trim()}
      >
        Commit
      </button>
    </div>
  );
}
