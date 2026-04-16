"use client";

import { useEffect, useRef, useState } from "react";

interface BuildLogViewerProps {
  logs: string[];
}

export function BuildLogViewer({ logs }: BuildLogViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
    setAutoScroll(atBottom);
  }

  if (logs.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-[#666]">
        ログはまだありません
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto bg-[#0d0d0d] p-2 font-mono text-[11px] leading-relaxed text-[#ccc]"
      >
        {logs.map((line, i) => (
          <div key={i} className="whitespace-pre-wrap break-all">
            {line}
          </div>
        ))}
      </div>
      {!autoScroll && (
        <button
          type="button"
          onClick={() => {
            setAutoScroll(true);
            if (containerRef.current) {
              containerRef.current.scrollTop = containerRef.current.scrollHeight;
            }
          }}
          className="absolute bottom-2 right-2 rounded bg-[#333] px-2 py-1 text-[10px] text-[#ccc] hover:bg-[#444]"
        >
          Scroll to bottom
        </button>
      )}
    </div>
  );
}
