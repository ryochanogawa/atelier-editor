import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { useWorkspaceStore } from "@/stores/workspace";

// React Testing Library cleanup
afterEach(() => {
  cleanup();
});

// Zustand store reset between tests
afterEach(() => {
  useWorkspaceStore.setState({
    status: "disconnected",
    workspaceInfo: null,
    tree: [],
    expandedPaths: new Set<string>(),
    openFiles: new Map(),
    activeTab: null,
    tabOrder: [],
    cursorPosition: null,
  });
});

// Mock next/dynamic to render children directly
vi.mock("next/dynamic", () => ({
  __esModule: true,
  default: (loader: () => Promise<{ default: React.ComponentType }>) => {
    // Return a component that lazily resolves the dynamic import
    const LazyComponent = (props: Record<string, unknown>) => {
      const Component = vi.fn(() => null);
      loader().then((mod) => Object.assign(Component, mod.default));
      return null;
    };
    return LazyComponent;
  },
}));

// Mock WebSocket globally
class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;

  readyState = MockWebSocket.OPEN;
  url: string;
  private listeners = new Map<string, Set<Function>>();

  constructor(url: string) {
    this.url = url;
  }

  addEventListener(event: string, handler: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  removeEventListener(event: string, handler: Function) {
    this.listeners.get(event)?.delete(handler);
  }

  dispatchEvent(event: string, data?: unknown) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        handler(data);
      }
    }
  }

  send = vi.fn();
  close = vi.fn();
}

Object.assign(globalThis, { WebSocket: MockWebSocket });
export { MockWebSocket };
