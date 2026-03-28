"use client";

import { useWorkspaceStore } from "@/stores/workspace";

export function TabBar() {
  const tabOrder = useWorkspaceStore((s) => s.tabOrder);
  const activeTab = useWorkspaceStore((s) => s.activeTab);
  const openFiles = useWorkspaceStore((s) => s.openFiles);
  const setActiveTab = useWorkspaceStore((s) => s.setActiveTab);
  const closeFile = useWorkspaceStore((s) => s.closeFile);

  if (tabOrder.length === 0) return null;

  return (
    <div className="flex h-9 shrink-0 items-stretch overflow-x-auto bg-[#252526]">
      {tabOrder.map((path) => {
        const file = openFiles.get(path);
        const isActive = path === activeTab;
        const isDirty = file ? file.content !== file.originalContent : false;
        const fileName = path.split("/").pop() ?? path;

        return (
          <button
            key={path}
            type="button"
            className={`group flex shrink-0 items-center gap-1.5 border-r border-[#1e1e1e] px-3 text-[13px] ${
              isActive
                ? "bg-[#1e1e1e] text-white"
                : "bg-[#2d2d2d] text-[#969696] hover:text-[#cccccc]"
            }`}
            onClick={() => setActiveTab(path)}
          >
            <span className="truncate max-w-[120px]">
              {isDirty && <span className="mr-1 text-[#c5c5c5]">●</span>}
              {fileName}
            </span>
            <span
              role="button"
              tabIndex={0}
              className="ml-1 flex h-5 w-5 items-center justify-center rounded text-[#969696] opacity-0 hover:bg-[#3c3c3c] hover:text-white group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                closeFile(path);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.stopPropagation();
                  closeFile(path);
                }
              }}
            >
              ×
            </span>
          </button>
        );
      })}
    </div>
  );
}
