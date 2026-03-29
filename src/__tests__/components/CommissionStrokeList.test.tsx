import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CommissionStrokeList } from "@/components/Editor/Commission/CommissionStrokeList";
import { useWorkspaceStore } from "@/stores/workspace";

describe("CommissionStrokeList", () => {
  it("renders nothing when strokes are empty", () => {
    const { container } = render(<CommissionStrokeList />);
    expect(container.firstChild).toBeNull();
  });

  it("renders Strokes heading when strokes exist", () => {
    useWorkspaceStore.setState({
      commissionStrokes: [
        { strokeId: "s-1", strokeName: "TypeCheck", status: "running" },
      ],
    });

    render(<CommissionStrokeList />);
    expect(screen.getByText("Strokes")).toBeInTheDocument();
  });

  it("renders stroke names", () => {
    useWorkspaceStore.setState({
      commissionStrokes: [
        { strokeId: "s-1", strokeName: "TypeCheck", status: "completed" },
        { strokeId: "s-2", strokeName: "Lint", status: "running" },
      ],
    });

    render(<CommissionStrokeList />);
    expect(screen.getByText("TypeCheck")).toBeInTheDocument();
    expect(screen.getByText("Lint")).toBeInTheDocument();
  });

  it("shows running indicator for running strokes", () => {
    useWorkspaceStore.setState({
      commissionStrokes: [
        { strokeId: "s-1", strokeName: "TypeCheck", status: "running" },
      ],
    });

    render(<CommissionStrokeList />);
    expect(screen.getByText("running")).toBeInTheDocument();
  });

  it("does not show running indicator for completed strokes", () => {
    useWorkspaceStore.setState({
      commissionStrokes: [
        { strokeId: "s-1", strokeName: "TypeCheck", status: "completed" },
      ],
    });

    render(<CommissionStrokeList />);
    expect(screen.queryByText("running")).not.toBeInTheDocument();
  });

  it("renders status icons for each status", () => {
    useWorkspaceStore.setState({
      commissionStrokes: [
        { strokeId: "s-1", strokeName: "Check", status: "completed" },
        { strokeId: "s-2", strokeName: "Build", status: "failed" },
        { strokeId: "s-3", strokeName: "Deploy", status: "running" },
      ],
    });

    render(<CommissionStrokeList />);
    // Completed: ✓, Failed: ✗, Running: ●
    expect(screen.getByText("✓")).toBeInTheDocument();
    expect(screen.getByText("✗")).toBeInTheDocument();
    expect(screen.getByText("●")).toBeInTheDocument();
  });
});
