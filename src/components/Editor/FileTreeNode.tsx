"use client";

import { memo } from "react";
import type { TreeEntry } from "@/lib/rpc/types";
import { useWorkspaceStore } from "@/stores/workspace";

interface FileTreeNodeProps {
  entry: TreeEntry;
  depth: number;
  onToggle: (path: string) => void;
  onFileSelect: (path: string) => void;
}

function FileTreeNodeInner({
  entry,
  depth,
  onToggle,
  onFileSelect,
}: FileTreeNodeProps) {
  const isExpanded = useWorkspaceStore((s) => s.expandedPaths.has(entry.path));
  const isDir = entry.type === "directory";
  const paddingLeft = 12 + depth * 16;

  function handleClick() {
    if (isDir) {
      onToggle(entry.path);
    } else {
      onFileSelect(entry.path);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  }

  return (
    <li role="treeitem" aria-expanded={isDir ? isExpanded : undefined}>
      <button
        type="button"
        className="flex w-full items-center gap-1.5 py-0.5 text-left text-sm hover:bg-[#2a2d2e] focus:bg-[#2a2d2e] focus:outline-none"
        style={{ paddingLeft }}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        <span className="shrink-0 w-4 text-center text-xs text-[#858585]">
          {isDir ? (isExpanded ? "▾" : "▸") : ""}
        </span>
        <span className="shrink-0 text-xs">
          {isDir ? "📁" : "📄"}
        </span>
        <span className="truncate">{entry.name}</span>
      </button>

      {isDir && isExpanded && entry.children && entry.children.length > 0 && (
        <ul role="group">
          {entry.children.map((child) => (
            <MemoizedFileTreeNode
              key={child.path}
              entry={child}
              depth={depth + 1}
              onToggle={onToggle}
              onFileSelect={onFileSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

const MemoizedFileTreeNode = memo(FileTreeNodeInner);

export { MemoizedFileTreeNode as FileTreeNode };
export type { FileTreeNodeProps };
