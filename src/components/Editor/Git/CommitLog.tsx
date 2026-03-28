"use client";

import type { GitLogEntry } from "@/lib/rpc/types";

interface CommitLogProps {
  entries: GitLogEntry[];
}

function relativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = Date.now();
  const diffSec = Math.floor((now - date.getTime()) / 1000);

  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 2592000) return `${Math.floor(diffSec / 86400)}d ago`;
  return date.toLocaleDateString();
}

export function CommitLog({ entries }: CommitLogProps) {
  if (entries.length === 0) return null;

  return (
    <section className="border-t border-[#3c3c3c]">
      <div className="px-4 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#bbbbbb]">
        Commits
      </div>
      <ul className="pb-2">
        {entries.map((entry) => (
          <li
            key={entry.hash}
            className="flex items-start gap-2 px-4 py-1 text-[12px] hover:bg-[#2a2d2e]"
          >
            <span className="shrink-0 font-mono text-[11px] text-[#858585]">
              {entry.hash.slice(0, 7)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[#cccccc]">{entry.message}</div>
              <div className="text-[11px] text-[#858585]">
                {entry.author} · {relativeDate(entry.date)}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
