import { describe, it, expect } from "vitest";
import { useWorkspaceStore } from "@/stores/workspace";
import { VIEWPORT_PRESETS } from "@/stores/workspace";

function getState() {
  return useWorkspaceStore.getState();
}

describe("workspace store – PreviewSlice", () => {
  // ── Initial state ──

  it("has correct initial state", () => {
    const state = getState();
    expect(state.previewVisible).toBe(false);
    expect(state.previewWidth).toBe(480);
    expect(state.devServerStatus).toBe("stopped");
    expect(state.previewUrl).toBeNull();
    expect(state.previewPort).toBeNull();
    expect(state.previewError).toBeNull();
    expect(state.previewLogs).toEqual([]);
    expect(state.activeViewport).toBeNull();
    expect(state.previewSource).toBe("vite");
  });

  // ── setPreviewVisible ──

  it("setPreviewVisible sets visibility", () => {
    getState().setPreviewVisible(true);
    expect(getState().previewVisible).toBe(true);

    getState().setPreviewVisible(false);
    expect(getState().previewVisible).toBe(false);
  });

  // ── togglePreview ──

  it("togglePreview toggles visibility", () => {
    expect(getState().previewVisible).toBe(false);

    getState().togglePreview();
    expect(getState().previewVisible).toBe(true);

    getState().togglePreview();
    expect(getState().previewVisible).toBe(false);
  });

  // ── setPreviewWidth ──

  it("setPreviewWidth updates width", () => {
    getState().setPreviewWidth(600);
    expect(getState().previewWidth).toBe(600);
  });

  // ── setDevServerStatus ──

  it("setDevServerStatus updates status", () => {
    getState().setDevServerStatus("starting");
    expect(getState().devServerStatus).toBe("starting");

    getState().setDevServerStatus("running");
    expect(getState().devServerStatus).toBe("running");

    getState().setDevServerStatus("error");
    expect(getState().devServerStatus).toBe("error");

    getState().setDevServerStatus("stopped");
    expect(getState().devServerStatus).toBe("stopped");
  });

  // ── setPreviewUrl ──

  it("setPreviewUrl sets url and port", () => {
    getState().setPreviewUrl("http://localhost:3000", 3000);
    expect(getState().previewUrl).toBe("http://localhost:3000");
    expect(getState().previewPort).toBe(3000);
  });

  it("setPreviewUrl clears url and port with null", () => {
    getState().setPreviewUrl("http://localhost:3000", 3000);
    getState().setPreviewUrl(null, null);
    expect(getState().previewUrl).toBeNull();
    expect(getState().previewPort).toBeNull();
  });

  it("setPreviewUrl sets source when provided", () => {
    getState().setPreviewUrl("http://localhost:49001", 49001, "container");
    expect(getState().previewSource).toBe("container");

    getState().setPreviewUrl("http://localhost:3000", 3000, "vite");
    expect(getState().previewSource).toBe("vite");
  });

  it("setPreviewUrl preserves source when not provided", () => {
    getState().setPreviewUrl("http://localhost:49001", 49001, "container");
    getState().setPreviewUrl("http://localhost:49002", 49002);
    expect(getState().previewSource).toBe("container");
  });

  // ── setPreviewError ──

  it("setPreviewError sets and clears error", () => {
    getState().setPreviewError("Port already in use");
    expect(getState().previewError).toBe("Port already in use");

    getState().setPreviewError(null);
    expect(getState().previewError).toBeNull();
  });

  // ── addPreviewLog ──

  it("addPreviewLog appends log line", () => {
    getState().addPreviewLog("Starting server...");
    getState().addPreviewLog("Listening on port 3000");
    expect(getState().previewLogs).toEqual([
      "Starting server...",
      "Listening on port 3000",
    ]);
  });

  it("addPreviewLog trims to 500 lines", () => {
    for (let i = 0; i < 505; i++) {
      getState().addPreviewLog(`line-${i}`);
    }
    const logs = getState().previewLogs;
    expect(logs).toHaveLength(500);
    expect(logs[0]).toBe("line-5");
    expect(logs[499]).toBe("line-504");
  });

  // ── clearPreviewLogs ──

  it("clearPreviewLogs empties logs", () => {
    getState().addPreviewLog("some log");
    getState().clearPreviewLogs();
    expect(getState().previewLogs).toEqual([]);
  });

  // ── setActiveViewport ──

  it("setActiveViewport sets viewport preset", () => {
    const mobile = VIEWPORT_PRESETS[0]; // Mobile
    getState().setActiveViewport(mobile);
    expect(getState().activeViewport).toEqual(mobile);
  });

  it("setActiveViewport clears with null (auto mode)", () => {
    getState().setActiveViewport(VIEWPORT_PRESETS[0]);
    getState().setActiveViewport(null);
    expect(getState().activeViewport).toBeNull();
  });

  // ── resetPreview ──

  it("resetPreview resets server state but preserves panel settings", () => {
    getState().setPreviewVisible(true);
    getState().setPreviewWidth(600);
    getState().setActiveViewport(VIEWPORT_PRESETS[1]);
    getState().setDevServerStatus("running");
    getState().setPreviewUrl("http://localhost:3000", 3000);
    getState().setPreviewError("some error");
    getState().addPreviewLog("log");

    getState().resetPreview();

    expect(getState().devServerStatus).toBe("stopped");
    expect(getState().previewUrl).toBeNull();
    expect(getState().previewPort).toBeNull();
    expect(getState().previewError).toBeNull();
    expect(getState().previewLogs).toEqual([]);
    // Panel settings preserved
    expect(getState().previewVisible).toBe(true);
    expect(getState().previewWidth).toBe(600);
    expect(getState().activeViewport).toEqual(VIEWPORT_PRESETS[1]);
  });

  // ── VIEWPORT_PRESETS ──

  it("VIEWPORT_PRESETS contains Mobile, Tablet, Desktop", () => {
    expect(VIEWPORT_PRESETS).toHaveLength(3);
    expect(VIEWPORT_PRESETS.map((p) => p.name)).toEqual(["Mobile", "Tablet", "Desktop"]);
    expect(VIEWPORT_PRESETS[0]).toEqual({ name: "Mobile", width: 375, height: 667 });
    expect(VIEWPORT_PRESETS[1]).toEqual({ name: "Tablet", width: 768, height: 1024 });
    expect(VIEWPORT_PRESETS[2]).toEqual({ name: "Desktop", width: 1440, height: 900 });
  });
});
