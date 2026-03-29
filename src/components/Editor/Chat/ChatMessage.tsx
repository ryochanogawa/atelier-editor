"use client";

import { useMemo } from "react";
import type { ChatMessage as ChatMessageType, CodeChange } from "@/lib/rpc/types";
import { CodeBlock } from "./CodeBlock";
import { DiffProposal } from "./DiffProposal";

interface ChatMessageProps {
  message: ChatMessageType;
  pendingChanges: CodeChange[];
  onAcceptChange: (changeId: string) => void;
  onRejectChange: (changeId: string) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onApplyCode?: (code: string) => void;
}

interface ContentPart {
  type: "text" | "code";
  content: string;
  language?: string;
}

function parseContent(content: string): ContentPart[] {
  const parts: ContentPart[] = [];
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: content.slice(lastIndex, match.index) });
    }
    parts.push({ type: "code", content: match[2], language: match[1] || undefined });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push({ type: "text", content: content.slice(lastIndex) });
  }

  return parts;
}

function TextContent({ text }: { text: string }) {
  // Simple inline formatting: **bold**, `inline code`, *italic*
  const lines = text.split("\n");
  return (
    <div className="whitespace-pre-wrap text-[13px] leading-6 text-[#d4d4d4]">
      {lines.map((line, i) => (
        <span key={i}>
          {line.split(/(`[^`]+`)/).map((segment, j) => {
            if (segment.startsWith("`") && segment.endsWith("`")) {
              return (
                <code
                  key={j}
                  className="rounded bg-[#3c3c3c] px-1 py-0.5 text-[12px] text-[#ce9178]"
                >
                  {segment.slice(1, -1)}
                </code>
              );
            }
            return <span key={j}>{segment}</span>;
          })}
          {i < lines.length - 1 && "\n"}
        </span>
      ))}
    </div>
  );
}

export function ChatMessageComponent({
  message,
  pendingChanges,
  onAcceptChange,
  onRejectChange,
  onAcceptAll,
  onRejectAll,
  onApplyCode,
}: ChatMessageProps) {
  const parts = useMemo(() => parseContent(message.content), [message.content]);
  const isUser = message.role === "user";

  // Find changes associated with this message
  const messageChanges = useMemo(() => {
    if (!message.codeChanges) return [];
    return message.codeChanges.map(
      (mc) => pendingChanges.find((pc) => pc.changeId === mc.changeId) ?? mc
    );
  }, [message.codeChanges, pendingChanges]);

  return (
    <div className={`px-4 py-3 ${isUser ? "bg-[#1e1e1e]" : "bg-[#252526]"}`}>
      {/* Role label */}
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[#858585]">
        {isUser ? "You" : "AI"}
      </div>

      {/* Content */}
      {parts.map((part, i) =>
        part.type === "code" ? (
          <CodeBlock
            key={i}
            code={part.content}
            language={part.language}
            onApplyToFile={onApplyCode}
          />
        ) : (
          <TextContent key={i} text={part.content} />
        )
      )}

      {/* Code changes diff proposals */}
      {messageChanges.length > 0 && (
        <DiffProposal
          changes={messageChanges}
          onAccept={onAcceptChange}
          onReject={onRejectChange}
          onAcceptAll={onAcceptAll}
          onRejectAll={onRejectAll}
        />
      )}
    </div>
  );
}
