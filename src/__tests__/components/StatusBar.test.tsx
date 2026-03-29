import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBar } from "@/components/Editor/StatusBar";
import { useWorkspaceStore } from "@/stores/workspace";

describe("StatusBar", () => {
  it("shows Disconnected status by default", () => {
    render(<StatusBar />);
    expect(screen.getByText("Disconnected")).toBeInTheDocument();
  });

  it("shows Connected status with green indicator", () => {
    useWorkspaceStore.setState({ status: "connected" });
    render(<StatusBar />);
    expect(screen.getByText("Connected")).toBeInTheDocument();
  });

  it("shows Connecting... status", () => {
    useWorkspaceStore.setState({ status: "connecting" });
    render(<StatusBar />);
    expect(screen.getByText("Connecting...")).toBeInTheDocument();
  });

  it("shows Reconnecting... status", () => {
    useWorkspaceStore.setState({ status: "reconnecting" });
    render(<StatusBar />);
    expect(screen.getByText("Reconnecting...")).toBeInTheDocument();
  });

  it("displays cursor position when set", () => {
    useWorkspaceStore.setState({ cursorPosition: { line: 42, column: 13 } });
    render(<StatusBar />);
    expect(screen.getByText("Ln 42, Col 13")).toBeInTheDocument();
  });

  it("does not display cursor position when null", () => {
    render(<StatusBar />);
    expect(screen.queryByText(/Ln \d+/)).not.toBeInTheDocument();
  });

  it("displays file language when a file is active", () => {
    const openFiles = new Map([
      ["/index.ts", { path: "/index.ts", content: "", originalContent: "", language: "typescript" }],
    ]);
    useWorkspaceStore.setState({ activeTab: "/index.ts", openFiles });
    render(<StatusBar />);
    expect(screen.getByText("typescript")).toBeInTheDocument();
  });

  it("always displays UTF-8", () => {
    render(<StatusBar />);
    expect(screen.getByText("UTF-8")).toBeInTheDocument();
  });

  it("does not display language when no file is active", () => {
    useWorkspaceStore.setState({ activeTab: null });
    render(<StatusBar />);
    // Only UTF-8 should be displayed, no language label
    expect(screen.queryByText("typescript")).not.toBeInTheDocument();
    expect(screen.queryByText("plaintext")).not.toBeInTheDocument();
  });

  it("displays green indicator for connected status", () => {
    useWorkspaceStore.setState({ status: "connected" });
    const { container } = render(<StatusBar />);
    const indicator = container.querySelector(".bg-green-500");
    expect(indicator).toBeInTheDocument();
  });

  it("displays red indicator for disconnected status", () => {
    const { container } = render(<StatusBar />);
    const indicator = container.querySelector(".bg-red-500");
    expect(indicator).toBeInTheDocument();
  });

  // Phase 2: Branch display

  it("displays current branch name when set", () => {
    useWorkspaceStore.setState({
      currentBranch: { name: "main", current: true, remote: "origin/main" },
    });
    render(<StatusBar />);
    expect(screen.getByText("main")).toBeInTheDocument();
  });

  it("does not display branch when currentBranch is null", () => {
    render(<StatusBar />);
    expect(screen.queryByText(/↑/)).not.toBeInTheDocument();
    expect(screen.queryByText(/↓/)).not.toBeInTheDocument();
  });

  it("displays ahead count", () => {
    useWorkspaceStore.setState({
      currentBranch: { name: "main", current: true, ahead: 3, behind: 0 },
    });
    render(<StatusBar />);
    expect(screen.getByText("↑3")).toBeInTheDocument();
  });

  it("displays behind count", () => {
    useWorkspaceStore.setState({
      currentBranch: { name: "main", current: true, ahead: 0, behind: 5 },
    });
    render(<StatusBar />);
    expect(screen.getByText("↓5")).toBeInTheDocument();
  });

  it("displays both ahead and behind counts", () => {
    useWorkspaceStore.setState({
      currentBranch: { name: "develop", current: true, ahead: 2, behind: 1 },
    });
    render(<StatusBar />);
    expect(screen.getByText("↑2")).toBeInTheDocument();
    expect(screen.getByText("↓1")).toBeInTheDocument();
  });

  it("does not display ahead/behind when zero", () => {
    useWorkspaceStore.setState({
      currentBranch: { name: "main", current: true, ahead: 0, behind: 0 },
    });
    render(<StatusBar />);
    expect(screen.queryByText(/↑/)).not.toBeInTheDocument();
    expect(screen.queryByText(/↓/)).not.toBeInTheDocument();
  });

  it("clicking branch switches sidebar to git view", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    useWorkspaceStore.setState({
      currentBranch: { name: "main", current: true },
    });
    render(<StatusBar />);

    await user.click(screen.getByText("main"));
    expect(useWorkspaceStore.getState().sidebarView).toBe("git");
  });

  // Phase 5: Preview toggle button

  describe("preview toggle button", () => {
    it("renders preview toggle button with correct title", () => {
      render(<StatusBar />);
      expect(screen.getByTitle("Toggle Preview")).toBeInTheDocument();
    });

    it("clicking preview toggle button toggles preview visibility", async () => {
      const { default: userEvent } = await import("@testing-library/user-event");
      const user = userEvent.setup();

      render(<StatusBar />);
      expect(useWorkspaceStore.getState().previewVisible).toBe(false);

      await user.click(screen.getByTitle("Toggle Preview"));
      expect(useWorkspaceStore.getState().previewVisible).toBe(true);

      await user.click(screen.getByTitle("Toggle Preview"));
      expect(useWorkspaceStore.getState().previewVisible).toBe(false);
    });

    it("shows green indicator when dev server is running", () => {
      useWorkspaceStore.setState({ devServerStatus: "running" });
      const { container } = render(<StatusBar />);
      // The small green dot next to the preview icon
      const indicators = container.querySelectorAll(".bg-green-400");
      expect(indicators.length).toBeGreaterThan(0);
    });

    it("does not show green indicator when dev server is stopped", () => {
      useWorkspaceStore.setState({ devServerStatus: "stopped" });
      const { container } = render(<StatusBar />);
      const indicators = container.querySelectorAll(".bg-green-400");
      expect(indicators.length).toBe(0);
    });
  });

  // Phase 3: Terminal toggle button

  describe("terminal toggle button", () => {
    it("renders terminal toggle button with correct title", () => {
      render(<StatusBar />);
      expect(screen.getByTitle("Toggle Terminal (Ctrl+`)")).toBeInTheDocument();
    });

    it("clicking terminal toggle button toggles terminal visibility", async () => {
      const { default: userEvent } = await import("@testing-library/user-event");
      const user = userEvent.setup();

      render(<StatusBar />);
      expect(useWorkspaceStore.getState().terminalVisible).toBe(false);

      await user.click(screen.getByTitle("Toggle Terminal (Ctrl+`)"));
      expect(useWorkspaceStore.getState().terminalVisible).toBe(true);

      await user.click(screen.getByTitle("Toggle Terminal (Ctrl+`)"));
      expect(useWorkspaceStore.getState().terminalVisible).toBe(false);
    });
  });
});
