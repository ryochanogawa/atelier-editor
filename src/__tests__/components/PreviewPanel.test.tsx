import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PreviewPanel } from "@/components/Editor/Preview/PreviewPanel";
import { useWorkspaceStore } from "@/stores/workspace";

// Mock PreviewToolbar to isolate PreviewPanel logic
vi.mock("@/components/Editor/Preview/PreviewToolbar", () => ({
  PreviewToolbar: () => <div data-testid="preview-toolbar">PreviewToolbar</div>,
}));

describe("PreviewPanel", () => {
  it("renders toolbar", () => {
    render(<PreviewPanel />);
    expect(screen.getByTestId("preview-toolbar")).toBeInTheDocument();
  });

  // ── Stopped state ──

  it("shows stopped message when devServerStatus is stopped", () => {
    render(<PreviewPanel />);
    expect(screen.getByText("Click Start to launch preview")).toBeInTheDocument();
  });

  it("does not render iframe when stopped", () => {
    const { container } = render(<PreviewPanel />);
    expect(container.querySelector("iframe")).not.toBeInTheDocument();
  });

  // ── Starting state ──

  it("shows spinner when devServerStatus is starting", () => {
    useWorkspaceStore.setState({ devServerStatus: "starting" });
    render(<PreviewPanel />);
    expect(screen.getByText("Starting dev server...")).toBeInTheDocument();
  });

  it("shows last 10 log lines when starting with logs", () => {
    const logs = Array.from({ length: 15 }, (_, i) => `log-${i}`);
    useWorkspaceStore.setState({ devServerStatus: "starting", previewLogs: logs });
    render(<PreviewPanel />);

    // Only last 10 should be visible
    expect(screen.queryByText("log-4")).not.toBeInTheDocument();
    expect(screen.getByText("log-5")).toBeInTheDocument();
    expect(screen.getByText("log-14")).toBeInTheDocument();
  });

  it("does not show log section when starting with no logs", () => {
    useWorkspaceStore.setState({ devServerStatus: "starting", previewLogs: [] });
    render(<PreviewPanel />);
    expect(screen.getByText("Starting dev server...")).toBeInTheDocument();
    // No log container rendered
    expect(screen.queryByText(/log-/)).not.toBeInTheDocument();
  });

  // ── Running state ──

  it("renders iframe when running with url", () => {
    useWorkspaceStore.setState({
      devServerStatus: "running",
      previewUrl: "http://localhost:3000",
    });
    const { container } = render(<PreviewPanel />);
    const iframe = container.querySelector("iframe");
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute("src", "http://localhost:3000");
    expect(iframe).toHaveAttribute("title", "Preview");
    expect(iframe).toHaveAttribute(
      "sandbox",
      "allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
    );
  });

  it("does not render iframe when running without url", () => {
    useWorkspaceStore.setState({
      devServerStatus: "running",
      previewUrl: null,
    });
    const { container } = render(<PreviewPanel />);
    expect(container.querySelector("iframe")).not.toBeInTheDocument();
    // Falls through to stopped state
    expect(screen.getByText("Click Start to launch preview")).toBeInTheDocument();
  });

  it("applies viewport dimensions when activeViewport is set", () => {
    useWorkspaceStore.setState({
      devServerStatus: "running",
      previewUrl: "http://localhost:3000",
      activeViewport: { name: "Mobile", width: 375, height: 667 },
    });
    const { container } = render(<PreviewPanel />);
    const wrapper = container.querySelector("iframe")!.parentElement!;
    expect(wrapper.style.width).toBe("375px");
  });

  it("uses full width when activeViewport is null", () => {
    useWorkspaceStore.setState({
      devServerStatus: "running",
      previewUrl: "http://localhost:3000",
      activeViewport: null,
    });
    const { container } = render(<PreviewPanel />);
    const wrapper = container.querySelector("iframe")!.parentElement!;
    expect(wrapper.style.width).toBe("100%");
  });

  // ── Error state ──

  it("shows error message when devServerStatus is error", () => {
    useWorkspaceStore.setState({ devServerStatus: "error" });
    render(<PreviewPanel />);
    expect(screen.getByText("Dev server error")).toBeInTheDocument();
  });

  it("shows error detail when previewError is set", () => {
    useWorkspaceStore.setState({
      devServerStatus: "error",
      previewError: "Port 3000 already in use",
    });
    render(<PreviewPanel />);
    expect(screen.getByText("Port 3000 already in use")).toBeInTheDocument();
  });

  it("does not show error detail when previewError is null", () => {
    useWorkspaceStore.setState({
      devServerStatus: "error",
      previewError: null,
    });
    render(<PreviewPanel />);
    expect(screen.getByText("Dev server error")).toBeInTheDocument();
    expect(screen.queryByText("Port")).not.toBeInTheDocument();
  });
});
