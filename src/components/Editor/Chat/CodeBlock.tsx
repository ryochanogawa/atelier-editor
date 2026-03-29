"use client";

import { useCallback, useState } from "react";

interface CodeBlockProps {
  code: string;
  language?: string;
  onApplyToFile?: (code: string) => void;
}

export function CodeBlock({ code, language, onApplyToFile }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <div className="group relative my-2 rounded border border-[#3c3c3c] bg-[#1e1e1e]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#3c3c3c] px-3 py-1">
        <span className="text-[11px] text-[#858585]">
          {language || "code"}
        </span>
        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            className="rounded px-2 py-0.5 text-[11px] text-[#969696] hover:bg-[#3c3c3c] hover:text-white"
            onClick={handleCopy}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
          {onApplyToFile && (
            <button
              type="button"
              className="rounded px-2 py-0.5 text-[11px] text-[#969696] hover:bg-[#3c3c3c] hover:text-white"
              onClick={() => onApplyToFile(code)}
            >
              Apply
            </button>
          )}
        </div>
      </div>
      {/* Code content */}
      <pre className="overflow-x-auto p-3 text-[13px] leading-5 text-[#d4d4d4]">
        <code>{code}</code>
      </pre>
    </div>
  );
}
