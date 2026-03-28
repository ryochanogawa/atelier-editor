import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { useWorkspaceStore } from "@/stores/workspace";

// Mock TerminalInstance since it depends on xterm dynamic imports
vi.mock("@/components/Editor/Terminal/TerminalInstance", () => ({
  TerminalInstance: ({ sessionId, isActive }: { sessionId: string; isActive: boolean }) => (
    <div data-testid={`terminal-${sessionId}`} data-active={isActive}>
      Terminal {sessionId}
    </div>
  ),
}));

// Mock RPC client
const mockCall = vi.fn();
vi.mock("@/lib/rpc/client", () => ({
  getRpcClient: () => ({
    call: mockCall,
  }),
}));

// Import after mocks
import { TerminalPanel } from "@/components/Editor/Terminal/TerminalPanel";

describe("TerminalPanel", () => {
  beforeEach(() => {
    mockCall.mockReset();
  });

  it("renders Terminal header label", () => {
    render(<TerminalPanel />);
    expect(screen.getByText("Terminal")).toBeInTheDocument();
  });

  it("shows Create Terminal button when no sessions exist", () => {
    render(<TerminalPanel />);
    expect(screen.getByText("Create Terminal")).toBeInTheDocument();
  });

  it("renders session tabs when sessions exist", () => {
    useWorkspaceStore.setState({
      terminalSessions: [
        { sessionId: "sess-1", active: true },
        { sessionId: "sess-2", active: true },
      ],
      activeTerminalId: "sess-1",
    });

    render(<TerminalPanel />);

    expect(screen.getByText("bash (1)")).toBeInTheDocument();
    expect(screen.getByText("bash (2)")).toBeInTheDocument();
  });

  it("displays 'exited' label for inactive sessions", () => {
    useWorkspaceStore.setState({
      terminalSessions: [{ sessionId: "sess-1", active: false }],
      activeTerminalId: "sess-1",
    });

    render(<TerminalPanel />);
    expect(screen.getByText("exited")).toBeInTheDocument();
  });

  it("renders TerminalInstance for each session", () => {
    useWorkspaceStore.setState({
      terminalSessions: [
        { sessionId: "sess-1", active: true },
        { sessionId: "sess-2", active: true },
      ],
      activeTerminalId: "sess-1",
    });

    render(<TerminalPanel />);

    expect(screen.getByTestId("terminal-sess-1")).toBeInTheDocument();
    expect(screen.getByTestId("terminal-sess-2")).toBeInTheDocument();
    expect(screen.getByTestId("terminal-sess-1")).toHaveAttribute("data-active", "true");
    expect(screen.getByTestId("terminal-sess-2")).toHaveAttribute("data-active", "false");
  });

  it("clicking tab switches active terminal", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();

    useWorkspaceStore.setState({
      terminalSessions: [
        { sessionId: "sess-1", active: true },
        { sessionId: "sess-2", active: true },
      ],
      activeTerminalId: "sess-1",
    });

    render(<TerminalPanel />);

    await user.click(screen.getByText("bash (2)"));
    expect(useWorkspaceStore.getState().activeTerminalId).toBe("sess-2");
  });

  it("clicking New Terminal button calls terminal.create RPC", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();

    mockCall.mockResolvedValue({ sessionId: "new-sess" });

    useWorkspaceStore.setState({
      terminalSessions: [{ sessionId: "sess-1", active: true }],
      activeTerminalId: "sess-1",
      status: "connected",
    });

    render(<TerminalPanel />);

    await user.click(screen.getByTitle("New Terminal"));

    expect(mockCall).toHaveBeenCalledWith("terminal.create", {});
  });

  it("clicking Close Panel button hides terminal", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();

    useWorkspaceStore.setState({
      terminalSessions: [{ sessionId: "sess-1", active: true }],
      activeTerminalId: "sess-1",
      terminalVisible: true,
    });

    render(<TerminalPanel />);

    await user.click(screen.getByTitle("Close Panel"));
    expect(useWorkspaceStore.getState().terminalVisible).toBe(false);
  });

  it("clicking kill button calls terminal.kill RPC and removes session", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();

    mockCall.mockResolvedValue({ success: true });

    useWorkspaceStore.setState({
      terminalSessions: [{ sessionId: "sess-1", active: true }],
      activeTerminalId: "sess-1",
    });

    render(<TerminalPanel />);

    await user.click(screen.getByTitle("Kill terminal"));

    await vi.waitFor(() => {
      expect(mockCall).toHaveBeenCalledWith("terminal.kill", { sessionId: "sess-1" });
    });

    await vi.waitFor(() => {
      expect(useWorkspaceStore.getState().terminalSessions).toHaveLength(0);
    });
  });

  it("auto-creates terminal session when connected with 0 sessions", async () => {
    mockCall.mockResolvedValue({ sessionId: "auto-sess" });

    useWorkspaceStore.setState({ status: "connected" });

    render(<TerminalPanel />);

    await vi.waitFor(() => {
      expect(mockCall).toHaveBeenCalledWith("terminal.create", {});
    });
  });

  it("does not auto-create terminal when disconnected", () => {
    useWorkspaceStore.setState({ status: "disconnected" });

    render(<TerminalPanel />);

    expect(mockCall).not.toHaveBeenCalled();
  });
});
