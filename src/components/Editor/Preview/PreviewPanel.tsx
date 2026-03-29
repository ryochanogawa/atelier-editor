"use client";

import { useWorkspaceStore } from "@/stores/workspace";
import { PreviewToolbar } from "./PreviewToolbar";

export function PreviewPanel() {
  const previewUrl = useWorkspaceStore((s) => s.previewUrl);
  const devServerStatus = useWorkspaceStore((s) => s.devServerStatus);
  const previewError = useWorkspaceStore((s) => s.previewError);
  const previewLogs = useWorkspaceStore((s) => s.previewLogs);
  const activeViewport = useWorkspaceStore((s) => s.activeViewport);

  const isRunning = devServerStatus === "running" && previewUrl;

  return (
    <div className="flex h-full flex-col bg-[#1e1e1e]">
      <PreviewToolbar />

      <div className="flex flex-1 items-center justify-center overflow-hidden">
        {isRunning ? (
          <div
            className="h-full bg-white"
            style={
              activeViewport
                ? {
                    width: activeViewport.width,
                    maxWidth: "100%",
                    maxHeight: "100%",
                  }
                : { width: "100%" }
            }
          >
            <iframe
              data-preview-iframe
              src={previewUrl}
              className="h-full w-full border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
              title="Preview"
            />
          </div>
        ) : devServerStatus === "starting" ? (
          <div className="flex flex-col items-center gap-3 text-[#8b8b8b]">
            <svg
              viewBox="0 0 24 24"
              className="h-8 w-8 animate-spin"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" strokeDasharray="40" strokeDashoffset="10" />
            </svg>
            <span className="text-sm">Starting dev server...</span>
            {previewLogs.length > 0 && (
              <div className="mt-2 max-h-32 w-full max-w-md overflow-y-auto rounded bg-[#1a1a1a] p-2 font-mono text-[11px] text-[#6a6a6a]">
                {previewLogs.slice(-10).map((line, i) => (
                  <div key={i} className="truncate">
                    {line}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : devServerStatus === "error" ? (
          <div className="flex flex-col items-center gap-2 px-4 text-center">
            <svg viewBox="0 0 16 16" className="h-8 w-8 text-red-400" fill="currentColor">
              <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 12.5a5.5 5.5 0 110-11 5.5 5.5 0 010 11zM7.25 5v4h1.5V5h-1.5zM7.25 10v1.5h1.5V10h-1.5z" />
            </svg>
            <span className="text-sm text-red-400">Dev server error</span>
            {previewError && (
              <span className="max-w-xs text-xs text-[#8b8b8b]">{previewError}</span>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-[#555555]">
            <svg viewBox="0 0 24 24" className="h-10 w-10" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
            <span className="text-sm">Click Start to launch preview</span>
          </div>
        )}
      </div>
    </div>
  );
}
