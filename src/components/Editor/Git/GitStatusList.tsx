"use client";

import { useMemo } from "react";
import type { GitStatusEntry } from "@/lib/rpc/types";
import { GitStatusItem } from "./GitStatusItem";

interface GitStatusListProps {
  entries: GitStatusEntry[];
}

export function GitStatusList({ entries }: GitStatusListProps) {
  const { staged, unstaged } = useMemo(() => {
    const staged: GitStatusEntry[] = [];
    const unstaged: GitStatusEntry[] = [];
    for (const entry of entries) {
      if (entry.staged) {
        staged.push(entry);
      } else {
        unstaged.push(entry);
      }
    }
    return { staged, unstaged };
  }, [entries]);

  if (entries.length === 0) {
    return (
      <div className="px-4 py-3 text-[12px] text-[#858585]">
        No changes detected
      </div>
    );
  }

  return (
    <div className="text-[12px]">
      {staged.length > 0 && (
        <section>
          <div className="flex items-center justify-between px-4 py-1 text-[11px] font-semibold uppercase text-[#bbbbbb]">
            <span>Staged Changes</span>
            <span className="rounded bg-[#3c3c3c] px-1.5 text-[10px]">
              {staged.length}
            </span>
          </div>
          <ul>
            {staged.map((entry) => (
              <GitStatusItem key={`staged-${entry.path}`} entry={entry} />
            ))}
          </ul>
        </section>
      )}

      {unstaged.length > 0 && (
        <section>
          <div className="flex items-center justify-between px-4 py-1 text-[11px] font-semibold uppercase text-[#bbbbbb]">
            <span>Changes</span>
            <span className="rounded bg-[#3c3c3c] px-1.5 text-[10px]">
              {unstaged.length}
            </span>
          </div>
          <ul>
            {unstaged.map((entry) => (
              <GitStatusItem key={`unstaged-${entry.path}`} entry={entry} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
