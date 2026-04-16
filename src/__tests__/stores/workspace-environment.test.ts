import { describe, it, expect } from "vitest";
import { useWorkspaceStore } from "@/stores/workspace";
import type { EnvironmentConfig } from "@/lib/environment/types";

function getState() {
  return useWorkspaceStore.getState();
}

const mockConfig: EnvironmentConfig = {
  version: "1",
  base: "node:20-slim",
  dev: { command: "npm run dev", port: 3000 },
};

describe("workspace store – EnvironmentSlice", () => {
  // ── Initial state ──

  it("has correct initial state", () => {
    const state = getState();
    expect(state.environments).toEqual({});
    expect(state.buildLogs).toEqual({});
    expect(state.environmentPanelTab).toBe("overview");
  });

  // ── setEnvironmentConfig ──

  it("setEnvironmentConfig creates new environment entry", () => {
    getState().setEnvironmentConfig("wt-1", mockConfig);

    const env = getState().environments["wt-1"];
    expect(env).toBeDefined();
    expect(env.worktreeId).toBe("wt-1");
    expect(env.config).toEqual(mockConfig);
    expect(env.status).toBe("idle");
    expect(env.hostPort).toBeNull();
    expect(env.containerId).toBeNull();
    expect(env.error).toBeNull();
    expect(env.setupCompleted).toBe(false);
    expect(env.serviceStates).toEqual({});
  });

  it("setEnvironmentConfig preserves existing fields when updating config", () => {
    getState().setEnvironmentConfig("wt-1", mockConfig);
    getState().setEnvironmentStatus("wt-1", "running", {
      hostPort: 3001,
      containerId: "abc123",
    });

    const updatedConfig = { ...mockConfig, base: "node:22-slim" };
    getState().setEnvironmentConfig("wt-1", updatedConfig);

    const env = getState().environments["wt-1"];
    expect(env.config).toEqual(updatedConfig);
    expect(env.status).toBe("running");
    expect(env.hostPort).toBe(3001);
    expect(env.containerId).toBe("abc123");
  });

  it("setEnvironmentConfig uses worktreeId as branch fallback", () => {
    getState().setEnvironmentConfig("feature/new", mockConfig);
    expect(getState().environments["feature/new"].branch).toBe("feature/new");
  });

  // ── setEnvironmentStatus ──

  it("setEnvironmentStatus updates status and extra fields", () => {
    getState().setEnvironmentConfig("wt-1", mockConfig);
    getState().setEnvironmentStatus("wt-1", "running", {
      hostPort: 3001,
      containerId: "abc123",
    });

    const env = getState().environments["wt-1"];
    expect(env.status).toBe("running");
    expect(env.hostPort).toBe(3001);
    expect(env.containerId).toBe("abc123");
  });

  it("setEnvironmentStatus clears error when status is not error", () => {
    getState().setEnvironmentConfig("wt-1", mockConfig);
    getState().setEnvironmentStatus("wt-1", "error", { error: "failed" });
    expect(getState().environments["wt-1"].error).toBe("failed");

    getState().setEnvironmentStatus("wt-1", "running");
    expect(getState().environments["wt-1"].error).toBeNull();
  });

  it("setEnvironmentStatus preserves error when status is error and no new error given", () => {
    getState().setEnvironmentConfig("wt-1", mockConfig);
    getState().setEnvironmentStatus("wt-1", "error", { error: "original" });
    getState().setEnvironmentStatus("wt-1", "error");

    expect(getState().environments["wt-1"].error).toBe("original");
  });

  it("setEnvironmentStatus does nothing for non-existent worktreeId", () => {
    const before = { ...getState().environments };
    getState().setEnvironmentStatus("non-existent", "running");
    expect(getState().environments).toEqual(before);
  });

  // ── appendBuildLog ──

  it("appendBuildLog adds log lines", () => {
    getState().appendBuildLog("wt-1", "Step 1/5: FROM node:20");
    getState().appendBuildLog("wt-1", "Step 2/5: COPY . .");

    expect(getState().buildLogs["wt-1"]).toEqual([
      "Step 1/5: FROM node:20",
      "Step 2/5: COPY . .",
    ]);
  });

  it("appendBuildLog trims to MAX_BUILD_LOGS (1000)", () => {
    for (let i = 0; i < 1005; i++) {
      getState().appendBuildLog("wt-1", `line-${i}`);
    }

    const logs = getState().buildLogs["wt-1"];
    expect(logs).toHaveLength(1000);
    expect(logs[0]).toBe("line-5");
    expect(logs[999]).toBe("line-1004");
  });

  // ── clearBuildLogs ──

  it("clearBuildLogs empties logs for worktree", () => {
    getState().appendBuildLog("wt-1", "some log");
    getState().appendBuildLog("wt-2", "other log");

    getState().clearBuildLogs("wt-1");

    expect(getState().buildLogs["wt-1"]).toEqual([]);
    expect(getState().buildLogs["wt-2"]).toEqual(["other log"]);
  });

  // ── removeEnvironment ──

  it("removeEnvironment removes environment and its build logs", () => {
    getState().setEnvironmentConfig("wt-1", mockConfig);
    getState().setEnvironmentConfig("wt-2", mockConfig);
    getState().appendBuildLog("wt-1", "log");

    getState().removeEnvironment("wt-1");

    expect(getState().environments["wt-1"]).toBeUndefined();
    expect(getState().buildLogs["wt-1"]).toBeUndefined();
    expect(getState().environments["wt-2"]).toBeDefined();
  });

  // ── setEnvironmentPanelTab ──

  it("setEnvironmentPanelTab switches tab", () => {
    getState().setEnvironmentPanelTab("logs");
    expect(getState().environmentPanelTab).toBe("logs");

    getState().setEnvironmentPanelTab("overview");
    expect(getState().environmentPanelTab).toBe("overview");
  });
});
