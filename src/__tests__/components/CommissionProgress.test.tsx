import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CommissionProgress } from "@/components/Editor/Commission/CommissionProgress";
import { useWorkspaceStore } from "@/stores/workspace";

describe("CommissionProgress", () => {
  it("shows 'Waiting for output...' when no logs", () => {
    render(<CommissionProgress />);
    expect(screen.getByText("Waiting for output...")).toBeInTheDocument();
  });

  it("renders log entries with phase and message", () => {
    useWorkspaceStore.setState({
      commissionLogs: [
        {
          phase: "compile",
          message: "Compiling sources",
          progress: 30,
          timestamp: "2026-01-01T12:00:00Z",
        },
      ],
    });

    render(<CommissionProgress />);
    expect(screen.getByText("[compile]")).toBeInTheDocument();
    expect(screen.getByText("Compiling sources")).toBeInTheDocument();
  });

  it("renders multiple log entries in order", () => {
    useWorkspaceStore.setState({
      commissionLogs: [
        {
          phase: "init",
          message: "Starting",
          progress: 0,
          timestamp: "2026-01-01T12:00:00Z",
        },
        {
          phase: "build",
          message: "Building",
          progress: 50,
          timestamp: "2026-01-01T12:00:01Z",
        },
      ],
    });

    render(<CommissionProgress />);
    expect(screen.getByText("[init]")).toBeInTheDocument();
    expect(screen.getByText("[build]")).toBeInTheDocument();
    expect(screen.getByText("Starting")).toBeInTheDocument();
    expect(screen.getByText("Building")).toBeInTheDocument();
  });

  it("shows progress bar when progress is set and status is running", () => {
    useWorkspaceStore.setState({
      commissionProgress: 65,
      commissionStatus: "running",
    });

    render(<CommissionProgress />);
    expect(screen.getByText("Progress")).toBeInTheDocument();
    expect(screen.getByText("65%")).toBeInTheDocument();
  });

  it("hides progress bar when progress is null", () => {
    useWorkspaceStore.setState({
      commissionProgress: null,
      commissionStatus: "running",
    });

    render(<CommissionProgress />);
    expect(screen.queryByText("Progress")).not.toBeInTheDocument();
  });

  it("hides progress bar when status is not running", () => {
    useWorkspaceStore.setState({
      commissionProgress: 100,
      commissionStatus: "completed",
    });

    render(<CommissionProgress />);
    expect(screen.queryByText("Progress")).not.toBeInTheDocument();
  });

  it("renders Log heading", () => {
    render(<CommissionProgress />);
    expect(screen.getByText("Log")).toBeInTheDocument();
  });
});
