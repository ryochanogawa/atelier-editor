import type {
  JsonRpcId,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  RpcMethodMap,
  NotificationMap,
  ConnectionStatus,
} from "./types";

export interface RpcClientOptions {
  url: string;
  requestTimeout?: number;
  reconnect?: {
    enabled: boolean;
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
  };
}

interface PendingRequest {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

type StatusHandler = (status: ConnectionStatus) => void;
type NotificationHandler = (params: unknown) => void;

export class RpcClient {
  private ws: WebSocket | null = null;
  private readonly options: Required<
    Pick<RpcClientOptions, "url" | "requestTimeout">
  > &
    Pick<RpcClientOptions, "reconnect">;
  private nextId = 1;
  private pending = new Map<JsonRpcId, PendingRequest>();
  private notificationHandlers = new Map<string, Set<NotificationHandler>>();
  private statusHandlers = new Set<StatusHandler>();
  private status: ConnectionStatus = "disconnected";
  private retryCount = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;

  constructor(options: RpcClientOptions) {
    this.options = {
      url: options.url,
      requestTimeout: options.requestTimeout ?? 10_000,
      reconnect: options.reconnect,
    };
  }

  connect(): void {
    if (this.ws) return;
    this.intentionalClose = false;
    this.setStatus("connecting");

    const ws = new WebSocket(this.options.url);

    ws.addEventListener("open", () => {
      this.retryCount = 0;
      this.setStatus("connected");
    });

    ws.addEventListener("message", (event) => {
      this.handleMessage(event.data as string);
    });

    ws.addEventListener("close", () => {
      this.ws = null;
      this.rejectAllPending("Connection closed");

      if (this.intentionalClose) {
        this.setStatus("disconnected");
        return;
      }

      this.attemptReconnect();
    });

    ws.addEventListener("error", () => {
      // close event will follow
    });

    this.ws = ws;
  }

  disconnect(): void {
    this.intentionalClose = true;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.rejectAllPending("Client disconnected");
    this.setStatus("disconnected");
  }

  call<M extends keyof RpcMethodMap>(
    method: M,
    params: RpcMethodMap[M]["params"]
  ): Promise<RpcMethodMap[M]["result"]> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error("Not connected"));
        return;
      }

      const id = this.nextId++;
      const request: JsonRpcRequest = {
        jsonrpc: "2.0",
        id,
        method,
        params,
      };

      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, this.options.requestTimeout);

      this.pending.set(id, {
        resolve: resolve as (result: unknown) => void,
        reject,
        timer,
      });

      this.ws.send(JSON.stringify(request));
    });
  }

  onNotification<N extends keyof NotificationMap>(
    method: N,
    handler: (params: NotificationMap[N]) => void
  ): () => void {
    const key = method as string;
    let handlers = this.notificationHandlers.get(key);
    if (!handlers) {
      handlers = new Set();
      this.notificationHandlers.set(key, handlers);
    }
    const wrappedHandler = handler as NotificationHandler;
    handlers.add(wrappedHandler);

    return () => {
      handlers.delete(wrappedHandler);
    };
  }

  onStatusChange(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    // 現在の状態を即座に通知
    handler(this.status);
    return () => {
      this.statusHandlers.delete(handler);
    };
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    for (const handler of this.statusHandlers) {
      handler(status);
    }
  }

  private handleMessage(raw: string): void {
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }

    const msg = data as Record<string, unknown>;

    // Notification (no id)
    if (!("id" in msg) && typeof msg["method"] === "string") {
      const notification = msg as unknown as JsonRpcNotification;
      const handlers = this.notificationHandlers.get(notification.method);
      if (handlers) {
        for (const handler of handlers) {
          handler(notification.params);
        }
      }
      return;
    }

    // Response
    const response = msg as unknown as JsonRpcResponse;
    const pending = this.pending.get(response.id);
    if (!pending) return;

    this.pending.delete(response.id);
    clearTimeout(pending.timer);

    if ("error" in response) {
      pending.reject(
        new Error(`RPC Error [${response.error.code}]: ${response.error.message}`)
      );
    } else {
      pending.resolve(response.result);
    }
  }

  private attemptReconnect(): void {
    const reconnect = this.options.reconnect;
    if (!reconnect?.enabled) {
      this.setStatus("disconnected");
      return;
    }

    const maxRetries = reconnect.maxRetries ?? 10;
    if (this.retryCount >= maxRetries) {
      this.setStatus("disconnected");
      return;
    }

    this.setStatus("reconnecting");

    const baseDelay = reconnect.baseDelay ?? 1_000;
    const maxDelay = reconnect.maxDelay ?? 30_000;
    const delay = Math.min(baseDelay * 2 ** this.retryCount, maxDelay);
    this.retryCount++;

    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.connect();
    }, delay);
  }

  private rejectAllPending(reason: string): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error(reason));
      this.pending.delete(id);
    }
  }
}

// シングルトンインスタンス
let clientInstance: RpcClient | null = null;

export function getRpcClient(): RpcClient {
  if (!clientInstance) {
    const wsUrl =
      typeof window !== "undefined"
        ? `ws://${window.location.hostname}:4000`
        : "ws://localhost:4000";

    clientInstance = new RpcClient({
      url: wsUrl,
      requestTimeout: 10_000,
      reconnect: {
        enabled: true,
        maxRetries: 10,
        baseDelay: 1_000,
        maxDelay: 30_000,
      },
    });
  }
  return clientInstance;
}
