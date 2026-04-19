import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { TerminalInstance } from "@/components/Editor/Terminal/TerminalInstance";
import { useWorkspaceStore } from "@/stores/workspace";

// --- Mock xterm ---
const mockWrite = vi.fn();
const mockOpen = vi.fn();
const mockDispose = vi.fn();
const mockOnData = vi.fn();
const mockLoadAddon = vi.fn();

class MockTerminal {
  cols = 80;
  rows = 24;
  write = mockWrite;
  open = mockOpen;
  dispose = mockDispose;
  onData = mockOnData;
  loadAddon = mockLoadAddon;
  __unsubs?: (() => void)[];
}

const mockFit = vi.fn();

class MockFitAddon {
  fit = mockFit;
}

vi.mock("@xterm/xterm", () => ({
  Terminal: MockTerminal,
}));

vi.mock("@xterm/addon-fit", () => ({
  FitAddon: MockFitAddon,
}));

// --- Mock RPC client ---
const mockCall = vi.fn().mockResolvedValue({});
const mockOnNotification = vi.fn();

vi.mock("@/lib/rpc/client", () => ({
  getRpcClient: () => ({
    call: mockCall,
    onNotification: mockOnNotification,
  }),
}));

// --- Mock ResizeObserver ---
const mockObserve = vi.fn();
const mockDisconnect = vi.fn();

class MockResizeObserver {
  callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  observe = mockObserve;
  unobserve = vi.fn();
  disconnect = mockDisconnect;
}
Object.assign(globalThis, { ResizeObserver: MockResizeObserver });

describe("TerminalInstance", () => {
  let notificationCallbacks: Record<string, (params: Record<string, unknown>) => void>;

  beforeEach(() => {
    notificationCallbacks = {};
    mockCall.mockReset().mockResolvedValue({});
    mockOnNotification.mockReset().mockImplementation((method: string, cb: (params: Record<string, unknown>) => void) => {
      notificationCallbacks[method] = cb;
      return vi.fn();
    });
    mockWrite.mockReset();
    mockOpen.mockReset();
    mockDispose.mockReset();
    mockOnData.mockReset();
    mockLoadAddon.mockReset();
    mockFit.mockReset();
    mockObserve.mockReset();
    mockDisconnect.mockReset();
  });

  it("initializes terminal and opens in container", async () => {
    render(<TerminalInstance sessionId="sess1" isActive={true} />);

    await vi.waitFor(() => {
      expect(mockOpen).toHaveBeenCalled();
      expect(mockFit).toHaveBeenCalled();
      expect(mockLoadAddon).toHaveBeenCalled();
    });
  });

  it("subscribes to terminal.output notifications", async () => {
    render(<TerminalInstance sessionId="sess1" isActive={true} />);

    await vi.waitFor(() => {
      expect(mockOnNotification).toHaveBeenCalledWith("terminal.output", expect.any(Function));
    });
  });

  it("subscribes to terminal.exit notifications", async () => {
    render(<TerminalInstance sessionId="sess1" isActive={true} />);

    await vi.waitFor(() => {
      expect(mockOnNotification).toHaveBeenCalledWith("terminal.exit", expect.any(Function));
    });
  });

  it("writes output data for matching sessionId", async () => {
    render(<TerminalInstance sessionId="sess1" isActive={true} />);

    await vi.waitFor(() => {
      expect(notificationCallbacks["terminal.output"]).toBeDefined();
    });

    notificationCallbacks["terminal.output"]({ sessionId: "sess1", data: "hello" });
    expect(mockWrite).toHaveBeenCalledWith("hello");
  });

  it("ignores output for different sessionId", async () => {
    render(<TerminalInstance sessionId="sess1" isActive={true} />);

    await vi.waitFor(() => {
      expect(notificationCallbacks["terminal.output"]).toBeDefined();
    });

    notificationCallbacks["terminal.output"]({ sessionId: "other", data: "hello" });
    expect(mockWrite).not.toHaveBeenCalledWith("hello");
  });

  it("writes exit message and marks terminal exited on terminal.exit", async () => {
    useWorkspaceStore.setState({
      terminalSessions: [{ sessionId: "sess1", active: true, target: "host" as const }],
    });

    render(<TerminalInstance sessionId="sess1" isActive={true} />);

    await vi.waitFor(() => {
      expect(notificationCallbacks["terminal.exit"]).toBeDefined();
    });

    notificationCallbacks["terminal.exit"]({ sessionId: "sess1", exitCode: 0 });

    expect(mockWrite).toHaveBeenCalledWith(
      expect.stringContaining("Process exited with code 0")
    );
    expect(useWorkspaceStore.getState().terminalSessions[0].active).toBe(false);
  });

  it("sends user input to server via terminal.input RPC", async () => {
    mockOnData.mockImplementation((cb: (data: string) => void) => {
      // Simulate user typing
      setTimeout(() => cb("ls\n"), 10);
    });

    render(<TerminalInstance sessionId="sess1" isActive={true} />);

    await vi.waitFor(() => {
      expect(mockCall).toHaveBeenCalledWith("terminal.input", {
        sessionId: "sess1",
        data: "ls\n",
      });
    });
  });

  it("hides container when not active", () => {
    const { container } = render(
      <TerminalInstance sessionId="sess1" isActive={false} />
    );
    const termDiv = container.firstChild as HTMLElement;
    expect(termDiv.style.display).toBe("none");
  });

  it("shows container when active", () => {
    const { container } = render(
      <TerminalInstance sessionId="sess1" isActive={true} />
    );
    const termDiv = container.firstChild as HTMLElement;
    expect(termDiv.style.display).toBe("block");
  });
});
