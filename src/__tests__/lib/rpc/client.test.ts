import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RpcClient } from "@/lib/rpc/client";

// --- Mock WebSocket with controllable lifecycle ---

class MockWS {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;

  readyState = MockWS.CONNECTING;
  url: string;
  private listeners = new Map<string, Set<Function>>();

  constructor(url: string) {
    this.url = url;
    // Store latest instance for test access
    MockWS.instances.push(this);
  }

  static instances: MockWS[] = [];
  static reset() {
    MockWS.instances = [];
  }
  static latest() {
    return MockWS.instances[MockWS.instances.length - 1];
  }

  addEventListener(event: string, handler: Function) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);
  }

  removeEventListener(event: string, handler: Function) {
    this.listeners.get(event)?.delete(handler);
  }

  emit(event: string, data?: unknown) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const h of handlers) h(data);
    }
  }

  simulateOpen() {
    this.readyState = MockWS.OPEN;
    this.emit("open");
  }

  simulateMessage(data: unknown) {
    this.emit("message", { data: JSON.stringify(data) });
  }

  simulateClose() {
    this.readyState = MockWS.CLOSED;
    this.emit("close");
  }

  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = MockWS.CLOSED;
  });
}

// Replace global WebSocket
const OriginalWebSocket = globalThis.WebSocket;

beforeEach(() => {
  vi.useFakeTimers();
  MockWS.reset();
  (globalThis as unknown as Record<string, unknown>).WebSocket = MockWS as unknown as typeof WebSocket;
});

afterEach(() => {
  vi.useRealTimers();
  (globalThis as unknown as Record<string, unknown>).WebSocket = OriginalWebSocket;
});

function createClient(overrides?: Partial<Parameters<typeof RpcClient.prototype.connect>[0]>) {
  return new RpcClient({
    url: "ws://localhost:4000",
    requestTimeout: 5000,
    reconnect: { enabled: false },
    ...overrides,
  });
}

describe("RpcClient", () => {
  // ── Connection lifecycle ──

  describe("connection lifecycle", () => {
    it("sets status to connecting then connected", () => {
      const statuses: string[] = [];
      const client = createClient();
      client.onStatusChange((s) => statuses.push(s));
      client.connect();

      expect(statuses).toContain("connecting");

      MockWS.latest().simulateOpen();
      expect(statuses).toContain("connected");
    });

    it("connect is idempotent when already connected", () => {
      const client = createClient();
      client.connect();
      client.connect(); // second call should be no-op
      expect(MockWS.instances).toHaveLength(1);
    });

    it("disconnect sets status to disconnected", () => {
      const statuses: string[] = [];
      const client = createClient();
      client.onStatusChange((s) => statuses.push(s));
      client.connect();
      MockWS.latest().simulateOpen();

      client.disconnect();
      expect(statuses[statuses.length - 1]).toBe("disconnected");
    });
  });

  // ── RPC call ──

  describe("call", () => {
    it("sends JSON-RPC request and resolves on success response", async () => {
      const client = createClient();
      client.connect();
      const ws = MockWS.latest();
      ws.simulateOpen();

      const promise = client.call("workspace.info", {} as Record<string, never>);

      // Parse sent message to get the id
      expect(ws.send).toHaveBeenCalledOnce();
      const sent = JSON.parse(ws.send.mock.calls[0][0]);
      expect(sent.jsonrpc).toBe("2.0");
      expect(sent.method).toBe("workspace.info");

      // Simulate response
      ws.simulateMessage({
        jsonrpc: "2.0",
        id: sent.id,
        result: { name: "test", rootPath: "/test" },
      });

      const result = await promise;
      expect(result).toEqual({ name: "test", rootPath: "/test" });
    });

    it("rejects on RPC error response", async () => {
      const client = createClient();
      client.connect();
      const ws = MockWS.latest();
      ws.simulateOpen();

      const promise = client.call("fs.readFile", { path: "/missing" });
      const sent = JSON.parse(ws.send.mock.calls[0][0]);

      ws.simulateMessage({
        jsonrpc: "2.0",
        id: sent.id,
        error: { code: -32601, message: "Not found" },
      });

      await expect(promise).rejects.toThrow("RPC Error [-32601]: Not found");
    });

    it("rejects when not connected", async () => {
      const client = createClient();
      await expect(
        client.call("workspace.info", {} as Record<string, never>)
      ).rejects.toThrow("Not connected");
    });

    it("rejects on timeout", async () => {
      const client = createClient({ requestTimeout: 1000 });
      client.connect();
      MockWS.latest().simulateOpen();

      const promise = client.call("workspace.info", {} as Record<string, never>);

      vi.advanceTimersByTime(1001);

      await expect(promise).rejects.toThrow("Request timeout: workspace.info");
    });

    it("rejects all pending requests on connection close", async () => {
      const client = createClient();
      client.connect();
      const ws = MockWS.latest();
      ws.simulateOpen();

      const promise = client.call("workspace.info", {} as Record<string, never>);

      ws.simulateClose();

      await expect(promise).rejects.toThrow("Connection closed");
    });
  });

  // ── Notifications ──

  describe("notifications", () => {
    it("dispatches notifications to handlers", () => {
      const client = createClient();
      client.connect();
      const ws = MockWS.latest();
      ws.simulateOpen();

      const handler = vi.fn();
      client.onNotification("fs.watch", handler);

      ws.simulateMessage({
        jsonrpc: "2.0",
        method: "fs.watch",
        params: { path: "/src/index.ts", type: "change" },
      });

      expect(handler).toHaveBeenCalledWith({
        path: "/src/index.ts",
        type: "change",
      });
    });

    it("unsubscribe removes handler", () => {
      const client = createClient();
      client.connect();
      const ws = MockWS.latest();
      ws.simulateOpen();

      const handler = vi.fn();
      const unsub = client.onNotification("fs.watch", handler);
      unsub();

      ws.simulateMessage({
        jsonrpc: "2.0",
        method: "fs.watch",
        params: { path: "/a", type: "create" },
      });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ── Status change ──

  describe("onStatusChange", () => {
    it("immediately fires with current status on subscribe", () => {
      const client = createClient();
      const handler = vi.fn();
      client.onStatusChange(handler);
      expect(handler).toHaveBeenCalledWith("disconnected");
    });

    it("unsubscribe stops further notifications", () => {
      const client = createClient();
      const handler = vi.fn();
      const unsub = client.onStatusChange(handler);
      handler.mockClear();

      unsub();
      client.connect();
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ── Reconnect ──

  describe("reconnection", () => {
    it("attempts reconnect with exponential backoff", () => {
      const client = new RpcClient({
        url: "ws://localhost:4000",
        requestTimeout: 5000,
        reconnect: { enabled: true, maxRetries: 3, baseDelay: 100, maxDelay: 5000 },
      });

      const statuses: string[] = [];
      client.onStatusChange((s) => statuses.push(s));
      client.connect();
      MockWS.latest().simulateOpen();
      statuses.length = 0;

      // Simulate disconnect
      MockWS.latest().simulateClose();
      expect(statuses).toContain("reconnecting");

      // Advance past first retry (100ms)
      vi.advanceTimersByTime(101);
      expect(MockWS.instances.length).toBe(2);
    });

    it("gives up after maxRetries", () => {
      const client = new RpcClient({
        url: "ws://localhost:4000",
        requestTimeout: 5000,
        reconnect: { enabled: true, maxRetries: 2, baseDelay: 100, maxDelay: 5000 },
      });

      const statuses: string[] = [];
      client.onStatusChange((s) => statuses.push(s));
      client.connect();
      MockWS.latest().simulateOpen();

      // Retry 1
      MockWS.latest().simulateClose();
      vi.advanceTimersByTime(101);
      MockWS.latest().simulateClose();

      // Retry 2
      vi.advanceTimersByTime(201);
      MockWS.latest().simulateClose();

      // Should be disconnected after max retries
      expect(statuses[statuses.length - 1]).toBe("disconnected");
    });

    it("does not reconnect on intentional disconnect", () => {
      const client = new RpcClient({
        url: "ws://localhost:4000",
        reconnect: { enabled: true, maxRetries: 5, baseDelay: 100 },
      });

      client.connect();
      MockWS.latest().simulateOpen();
      const countBefore = MockWS.instances.length;

      client.disconnect();
      vi.advanceTimersByTime(5000);

      expect(MockWS.instances.length).toBe(countBefore);
    });
  });

  // ── Message parsing edge cases ──

  describe("message handling edge cases", () => {
    it("ignores malformed JSON", () => {
      const client = createClient();
      client.connect();
      const ws = MockWS.latest();
      ws.simulateOpen();

      // Should not throw
      ws.emit("message", { data: "not json{{{" });
    });

    it("ignores responses with unknown id", () => {
      const client = createClient();
      client.connect();
      const ws = MockWS.latest();
      ws.simulateOpen();

      // Should not throw
      ws.simulateMessage({ jsonrpc: "2.0", id: 99999, result: {} });
    });
  });

  // ── Additional edge cases ──

  describe("exponential backoff", () => {
    it("caps delay at maxDelay", () => {
      const client = new RpcClient({
        url: "ws://localhost:4000",
        requestTimeout: 5000,
        reconnect: { enabled: true, maxRetries: 5, baseDelay: 100, maxDelay: 300 },
      });

      client.connect();
      MockWS.latest().simulateOpen();

      // Retry 1: delay = 100 * 2^0 = 100ms
      MockWS.latest().simulateClose();
      vi.advanceTimersByTime(101);
      expect(MockWS.instances).toHaveLength(2);

      // Retry 2: delay = 100 * 2^1 = 200ms
      MockWS.latest().simulateClose();
      vi.advanceTimersByTime(201);
      expect(MockWS.instances).toHaveLength(3);

      // Retry 3: delay = min(100 * 2^2 = 400, 300) = 300ms (capped)
      MockWS.latest().simulateClose();
      vi.advanceTimersByTime(299);
      expect(MockWS.instances).toHaveLength(3); // Not yet
      vi.advanceTimersByTime(2);
      expect(MockWS.instances).toHaveLength(4); // Now connected
    });
  });

  describe("multiple handlers", () => {
    it("supports multiple notification handlers for same method", () => {
      const client = createClient();
      client.connect();
      const ws = MockWS.latest();
      ws.simulateOpen();

      const handler1 = vi.fn();
      const handler2 = vi.fn();
      client.onNotification("fs.watch", handler1);
      client.onNotification("fs.watch", handler2);

      ws.simulateMessage({
        jsonrpc: "2.0",
        method: "fs.watch",
        params: { path: "/a", type: "change" },
      });

      expect(handler1).toHaveBeenCalledOnce();
      expect(handler2).toHaveBeenCalledOnce();
    });

    it("supports multiple status handlers", () => {
      const client = createClient();
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      client.onStatusChange(handler1);
      client.onStatusChange(handler2);

      handler1.mockClear();
      handler2.mockClear();

      client.connect();
      expect(handler1).toHaveBeenCalledWith("connecting");
      expect(handler2).toHaveBeenCalledWith("connecting");
    });
  });

  describe("call edge cases", () => {
    it("rejects when WebSocket exists but is not OPEN", () => {
      const client = createClient();
      client.connect();
      // ws is still in CONNECTING state (not opened yet)

      expect(
        client.call("workspace.info", {} as Record<string, never>)
      ).rejects.toThrow("Not connected");
    });

    it("getStatus returns current connection status", () => {
      const client = createClient();
      expect(client.getStatus()).toBe("disconnected");

      client.connect();
      expect(client.getStatus()).toBe("connecting");

      MockWS.latest().simulateOpen();
      expect(client.getStatus()).toBe("connected");
    });
  });

  describe("disconnect edge cases", () => {
    it("clears pending retry timer on disconnect", () => {
      const client = new RpcClient({
        url: "ws://localhost:4000",
        requestTimeout: 5000,
        reconnect: { enabled: true, maxRetries: 3, baseDelay: 1000, maxDelay: 5000 },
      });

      client.connect();
      MockWS.latest().simulateOpen();
      const countAfterConnect = MockWS.instances.length;

      // Trigger reconnect
      MockWS.latest().simulateClose();

      // Disconnect before retry timer fires
      client.disconnect();

      // Advance past retry delay - should NOT create new connection
      vi.advanceTimersByTime(5000);
      expect(MockWS.instances.length).toBe(countAfterConnect);
    });
  });
});
