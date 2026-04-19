"use client";

import { useCallback } from "react";
import { getRpcClient } from "@/lib/rpc/client";
import { useWorkspaceStore } from "@/stores/workspace";
import { VIEWPORT_PRESETS } from "@/stores/workspace";
import type { ViewportPreset } from "@/lib/rpc/types";

export function PreviewToolbar() {
  const devServerStatus = useWorkspaceStore((s) => s.devServerStatus);
  const activeViewport = useWorkspaceStore((s) => s.activeViewport);
  const setActiveViewport = useWorkspaceStore((s) => s.setActiveViewport);
  const setPreviewVisible = useWorkspaceStore((s) => s.setPreviewVisible);
  const addToast = useWorkspaceStore((s) => s.addToast);

  const previewUrl = useWorkspaceStore((s) => s.previewUrl);

  const isRunning = devServerStatus === "running";
  const isStarting = devServerStatus === "starting";

  const handleStartStop = useCallback(async () => {
    const client = getRpcClient();
    try {
      if (isRunning) {
        await client.call("preview.stop", {});
      } else {
        await client.call("preview.start", {});
      }
    } catch (err) {
      addToast(`Preview: ${err instanceof Error ? err.message : String(err)}`, "error");
    }
  }, [isRunning, addToast]);

  const handleReload = useCallback(() => {
    const iframe = document.querySelector<HTMLIFrameElement>("[data-preview-iframe]");
    if (iframe) {
      iframe.contentWindow?.location.reload();
    }
  }, []);

  const handleViewportChange = useCallback(
    (preset: ViewportPreset | null) => {
      setActiveViewport(preset);
    },
    [setActiveViewport]
  );

  const handlePopout = useCallback(() => {
    if (previewUrl) {
      window.open(previewUrl, "_blank", "width=1280,height=720");
    }
  }, [previewUrl]);

  const handleClose = useCallback(() => {
    setPreviewVisible(false);
  }, [setPreviewVisible]);

  return (
    <div className="flex h-8 shrink-0 items-center justify-between border-b border-[#1e1e1e] bg-[#252526] px-2">
      <div className="flex items-center gap-1.5">
        {/* Start/Stop button */}
        <button
          type="button"
          className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] ${
            isRunning
              ? "bg-red-600/20 text-red-400 hover:bg-red-600/30"
              : isStarting
                ? "cursor-wait bg-yellow-600/20 text-yellow-400"
                : "bg-green-600/20 text-green-400 hover:bg-green-600/30"
          }`}
          onClick={handleStartStop}
          disabled={isStarting}
          title={isRunning ? "Stop dev server" : "Start dev server"}
        >
          {isRunning ? (
            <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor">
              <rect x="4" y="4" width="8" height="8" />
            </svg>
          ) : isStarting ? (
            <svg viewBox="0 0 16 16" className="h-3 w-3 animate-spin" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="8" cy="8" r="6" strokeDasharray="20" strokeDashoffset="5" />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor">
              <polygon points="4,2 14,8 4,14" />
            </svg>
          )}
          <span>{isRunning ? "Stop" : isStarting ? "Starting..." : "Start"}</span>
        </button>

        {/* Reload button */}
        <button
          type="button"
          className="rounded p-0.5 text-[#cccccc] hover:bg-[#3c3c3c] disabled:opacity-30"
          onClick={handleReload}
          disabled={!isRunning}
          title="Reload preview"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor">
            <path d="M13.451 5.609l-.579-.939-1.068.812-.076.094c.335.57.528 1.236.528 1.949 0 2.044-1.577 3.71-3.567 3.853l.443-.896-.872-.509-1.378 2.793L9.051 15l.872-.509-.652-1.321c2.674-.233 4.773-2.48 4.773-5.246 0-.802-.181-1.561-.502-2.238l-.091-.077zM7.875 3.592l-.652-1.321-.872.509.443.896C4.12 3.909 2.044 6.156 2.044 8.922c0 .802.181 1.561.502 2.238l.091.077.579.939 1.068-.812.076-.094a3.857 3.857 0 01-.527-1.949c0-2.044 1.576-3.71 3.567-3.853l-.443.896.872.509 1.378-2.793L7.013 2.1l-.01.001.872.509v.982z" />
          </svg>
        </button>

        {/* Popout button */}
        <button
          type="button"
          className="rounded p-0.5 text-[#cccccc] hover:bg-[#3c3c3c] disabled:opacity-30"
          onClick={handlePopout}
          disabled={!isRunning}
          title="Open in new window"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor">
            <path d="M1.5 1H6v1H2v12h12v-4h1v4.5l-.5.5h-13l-.5-.5v-13l.5-.5zM15 1.5V8h-1V2.707L7.854 8.854l-.708-.708L13.293 2H8V1h6.5l.5.5z" />
          </svg>
        </button>

        {/* Separator */}
        <div className="mx-1 h-4 w-px bg-[#3c3c3c]" />

        {/* Viewport presets */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className={`rounded px-1.5 py-0.5 text-[11px] ${
              activeViewport === null
                ? "bg-[#007acc] text-white"
                : "text-[#cccccc] hover:bg-[#3c3c3c]"
            }`}
            onClick={() => handleViewportChange(null)}
            title="Responsive (fill panel)"
          >
            Auto
          </button>
          {VIEWPORT_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              className={`rounded px-1.5 py-0.5 text-[11px] ${
                activeViewport?.name === preset.name
                  ? "bg-[#007acc] text-white"
                  : "text-[#cccccc] hover:bg-[#3c3c3c]"
              }`}
              onClick={() => handleViewportChange(preset)}
              title={`${preset.name} (${preset.width}x${preset.height})`}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1">
        {/* Server status indicator */}
        <span className="flex items-center gap-1 text-[11px] text-[#8b8b8b]">
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              devServerStatus === "running"
                ? "bg-green-500"
                : devServerStatus === "starting"
                  ? "bg-yellow-500 animate-pulse"
                  : devServerStatus === "error"
                    ? "bg-red-500"
                    : "bg-[#555555]"
            }`}
          />
          {devServerStatus}
        </span>

        {/* Close button */}
        <button
          type="button"
          className="rounded p-0.5 text-[#cccccc] hover:bg-[#3c3c3c]"
          onClick={handleClose}
          title="Close preview panel"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor">
            <path d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.707.708L7.293 8l-3.646 3.646.707.708L8 8.707z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
