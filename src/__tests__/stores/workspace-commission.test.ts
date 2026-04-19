import { describe, it, expect } from "vitest";
import { useWorkspaceStore } from "@/stores/workspace";
import type { CommissionDefinition } from "@/lib/rpc/types";

function getState() {
  return useWorkspaceStore.getState();
}

describe("CommissionSlice", () => {
  // ── Initial State ──

  it("has empty initial commission state", () => {
    const state = getState();
    expect(state.commissionDefinitions).toEqual([]);
    expect(state.activeCommissionId).toBeNull();
    expect(state.commissionStatus).toBeNull();
    expect(state.commissionLogs).toEqual([]);
    expect(state.commissionStrokes).toEqual([]);
    expect(state.commissionProgress).toBeNull();
    expect(state.commissionResult).toBeNull();
  });

  // ── setCommissionDefinitions ──

  describe("setCommissionDefinitions", () => {
    it("stores commission definitions", () => {
      const defs: CommissionDefinition[] = [
        { name: "build", description: "Build the project" },
        { name: "lint", description: "Run linter", params: { fix: { type: "boolean", description: "Auto-fix" } } },
      ];

      getState().setCommissionDefinitions(defs);
      expect(getState().commissionDefinitions).toEqual(defs);
    });

    it("replaces existing definitions", () => {
      getState().setCommissionDefinitions([{ name: "old", description: "Old" }]);
      getState().setCommissionDefinitions([{ name: "new", description: "New" }]);
      expect(getState().commissionDefinitions).toEqual([
        { name: "new", description: "New" },
      ]);
    });

    it("clears loading and error flags when definitions are set", () => {
      getState().setCommissionDefinitionsLoading(true);
      getState().setCommissionDefinitionsError("Network error");

      getState().setCommissionDefinitions([{ name: "build", description: "Build" }]);

      expect(getState().commissionDefinitionsLoading).toBe(false);
      expect(getState().commissionDefinitionsError).toBeNull();
    });
  });

  // ── setCommissionDefinitionsLoading ──

  describe("setCommissionDefinitionsLoading", () => {
    it("sets loading to true", () => {
      getState().setCommissionDefinitionsLoading(true);
      expect(getState().commissionDefinitionsLoading).toBe(true);
    });

    it("sets loading to false", () => {
      getState().setCommissionDefinitionsLoading(true);
      getState().setCommissionDefinitionsLoading(false);
      expect(getState().commissionDefinitionsLoading).toBe(false);
    });
  });

  // ── setCommissionDefinitionsError ──

  describe("setCommissionDefinitionsError", () => {
    it("sets error message and clears loading", () => {
      getState().setCommissionDefinitionsLoading(true);
      getState().setCommissionDefinitionsError("Failed to fetch");

      expect(getState().commissionDefinitionsError).toBe("Failed to fetch");
      expect(getState().commissionDefinitionsLoading).toBe(false);
    });

    it("clears error with null", () => {
      getState().setCommissionDefinitionsError("Some error");
      getState().setCommissionDefinitionsError(null);
      expect(getState().commissionDefinitionsError).toBeNull();
    });
  });

  // ── startCommission ──

  describe("startCommission", () => {
    it("sets active commission with running status and clears previous data", () => {
      // Arrange: set some prior state
      getState().addCommissionLog({
        phase: "old",
        message: "old log",
        progress: 50,
        timestamp: "2026-01-01T00:00:00Z",
      });

      // Act
      getState().startCommission("comm-123");

      // Assert
      const state = getState();
      expect(state.activeCommissionId).toBe("comm-123");
      expect(state.commissionStatus).toBe("running");
      expect(state.commissionLogs).toEqual([]);
      expect(state.commissionStrokes).toEqual([]);
      expect(state.commissionProgress).toBeNull();
      expect(state.commissionResult).toBeNull();
    });
  });

  // ── addCommissionLog ──

  describe("addCommissionLog", () => {
    it("appends log entry", () => {
      const entry = {
        phase: "compile",
        message: "Compiling...",
        progress: 30,
        timestamp: "2026-01-01T00:00:00Z",
      };

      getState().addCommissionLog(entry);
      expect(getState().commissionLogs).toEqual([entry]);
    });

    it("appends multiple log entries in order", () => {
      const entry1 = {
        phase: "compile",
        message: "Start",
        progress: 0,
        timestamp: "2026-01-01T00:00:00Z",
      };
      const entry2 = {
        phase: "compile",
        message: "Done",
        progress: 100,
        timestamp: "2026-01-01T00:00:01Z",
      };

      getState().addCommissionLog(entry1);
      getState().addCommissionLog(entry2);
      expect(getState().commissionLogs).toEqual([entry1, entry2]);
    });

    it("updates commissionProgress from log entry", () => {
      getState().addCommissionLog({
        phase: "build",
        message: "Building",
        progress: 42,
        timestamp: "2026-01-01T00:00:00Z",
      });
      expect(getState().commissionProgress).toBe(42);
    });

    it("keeps previous progress when log entry has null progress", () => {
      getState().addCommissionLog({
        phase: "build",
        message: "Building",
        progress: 42,
        timestamp: "2026-01-01T00:00:00Z",
      });
      getState().addCommissionLog({
        phase: "build",
        message: "Still building",
        progress: null,
        timestamp: "2026-01-01T00:00:01Z",
      });
      expect(getState().commissionProgress).toBe(42);
    });
  });

  // ── updateCommissionStroke ──

  describe("updateCommissionStroke", () => {
    it("adds a new stroke", () => {
      const stroke = {
        strokeId: "s-1",
        strokeName: "TypeCheck",
        status: "running" as const,
      };

      getState().updateCommissionStroke(stroke);
      expect(getState().commissionStrokes).toEqual([stroke]);
    });

    it("updates an existing stroke by strokeId", () => {
      getState().updateCommissionStroke({
        strokeId: "s-1",
        strokeName: "TypeCheck",
        status: "running",
      });
      getState().updateCommissionStroke({
        strokeId: "s-1",
        strokeName: "TypeCheck",
        status: "completed",
      });

      expect(getState().commissionStrokes).toHaveLength(1);
      expect(getState().commissionStrokes[0].status).toBe("completed");
    });

    it("keeps other strokes when updating one", () => {
      getState().updateCommissionStroke({
        strokeId: "s-1",
        strokeName: "TypeCheck",
        status: "completed",
      });
      getState().updateCommissionStroke({
        strokeId: "s-2",
        strokeName: "Lint",
        status: "running",
      });
      getState().updateCommissionStroke({
        strokeId: "s-2",
        strokeName: "Lint",
        status: "failed",
      });

      expect(getState().commissionStrokes).toHaveLength(2);
      expect(getState().commissionStrokes[0].status).toBe("completed");
      expect(getState().commissionStrokes[1].status).toBe("failed");
    });
  });

  // ── completeCommission ──

  describe("completeCommission", () => {
    it("sets status to completed on success", () => {
      getState().startCommission("c-1");
      getState().completeCommission({
        status: "success",
        changedFiles: ["a.ts"],
        summary: "Done",
      });

      expect(getState().commissionStatus).toBe("completed");
      expect(getState().commissionResult?.status).toBe("success");
      expect(getState().commissionResult?.changedFiles).toEqual(["a.ts"]);
    });

    it("sets status to failed on failure", () => {
      getState().startCommission("c-1");
      getState().completeCommission({
        status: "failure",
        error: "Build failed",
      });

      expect(getState().commissionStatus).toBe("failed");
      expect(getState().commissionResult?.error).toBe("Build failed");
    });

    it("sets status to aborted", () => {
      getState().startCommission("c-1");
      getState().completeCommission({ status: "aborted" });

      expect(getState().commissionStatus).toBe("aborted");
    });
  });

  // ── clearCommission ──

  describe("clearCommission", () => {
    it("resets all commission state", () => {
      // Arrange
      getState().startCommission("c-1");
      getState().addCommissionLog({
        phase: "build",
        message: "msg",
        progress: 50,
        timestamp: "2026-01-01T00:00:00Z",
      });
      getState().updateCommissionStroke({
        strokeId: "s-1",
        strokeName: "Check",
        status: "running",
      });

      // Act
      getState().clearCommission();

      // Assert
      const state = getState();
      expect(state.activeCommissionId).toBeNull();
      expect(state.commissionStatus).toBeNull();
      expect(state.commissionLogs).toEqual([]);
      expect(state.commissionStrokes).toEqual([]);
      expect(state.commissionProgress).toBeNull();
      expect(state.commissionResult).toBeNull();
    });
  });

  // ── sidebarView with commission ──

  it("supports commission as sidebarView", () => {
    getState().setSidebarView("commission");
    expect(getState().sidebarView).toBe("commission");
  });
});
