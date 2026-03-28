// === JSON-RPC 2.0 基本型 ===

export type JsonRpcId = string | number;

export interface JsonRpcRequest<P = Record<string, unknown>> {
  jsonrpc: "2.0";
  id: JsonRpcId;
  method: string;
  params: P;
}

export interface JsonRpcSuccessResponse<R = unknown> {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result: R;
}

export interface JsonRpcErrorResponse {
  jsonrpc: "2.0";
  id: JsonRpcId;
  error: JsonRpcError;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export type JsonRpcResponse<R = unknown> =
  | JsonRpcSuccessResponse<R>
  | JsonRpcErrorResponse;

export interface JsonRpcNotification<P = Record<string, unknown>> {
  jsonrpc: "2.0";
  method: string;
  params: P;
}

// === 標準エラーコード ===
export const RPC_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

// === ドメイン型 ===

export type FileType = "file" | "directory";

export interface TreeEntry {
  name: string;
  path: string;
  type: FileType;
  children?: TreeEntry[];
}

export interface FileContent {
  path: string;
  content: string;
  encoding: "utf-8";
  language?: string;
}

export interface WorkspaceInfo {
  name: string;
  rootPath: string;
}

// === RPC メソッド型マップ ===

export interface RpcMethodMap {
  "workspace.info": {
    params: Record<string, never>;
    result: WorkspaceInfo;
  };
  "fs.readTree": {
    params: { path?: string; depth?: number };
    result: TreeEntry[];
  };
  "fs.readFile": {
    params: { path: string };
    result: FileContent;
  };
  "fs.writeFile": {
    params: { path: string; content: string };
    result: { success: boolean };
  };

  // Git methods
  "git.status": {
    params: { worktreeId?: string };
    result: GitStatusEntry[];
  };
  "git.branches": {
    params: { worktreeId?: string };
    result: GitBranch[];
  };
  "git.diff": {
    params: { path: string; worktreeId?: string };
    result: GitDiffFile;
  };
  "git.stage": {
    params: { paths: string[]; worktreeId?: string };
    result: { success: boolean };
  };
  "git.unstage": {
    params: { paths: string[]; worktreeId?: string };
    result: { success: boolean };
  };
  "git.commit": {
    params: { message: string; worktreeId?: string };
    result: { hash: string };
  };
  "git.push": {
    params: { worktreeId?: string };
    result: { success: boolean };
  };
  "git.log": {
    params: { limit?: number; worktreeId?: string };
    result: GitLogEntry[];
  };

  // Studio (worktree) methods
  "studio.list": {
    params: Record<string, never>;
    result: WorktreeInfo[];
  };
  "studio.create": {
    params: { branch: string };
    result: WorktreeInfo;
  };
  "studio.switch": {
    params: { worktreeId: string };
    result: { success: boolean };
  };
  "studio.remove": {
    params: { worktreeId: string };
    result: { success: boolean };
  };
}

// === 通知型マップ ===

export type WatchEventType = "create" | "change" | "delete";

export interface FsWatchParams {
  path: string;
  type: WatchEventType;
}

export interface GitChangeParams {
  worktreeId: string;
  type: "status" | "branch" | "commit";
}

export interface StudioChangeParams {
  type: "created" | "removed" | "switched";
  worktreeId: string;
}

export interface NotificationMap {
  "fs.watch": FsWatchParams;
  "git.changed": GitChangeParams;
  "studio.changed": StudioChangeParams;
}

// === Git ドメイン型 ===

export type GitFileStatus = "modified" | "added" | "deleted" | "renamed" | "untracked";

export interface GitStatusEntry {
  path: string;
  status: GitFileStatus;
  staged: boolean;
}

export interface GitBranch {
  name: string;
  current: boolean;
  remote?: string;
  ahead?: number;
  behind?: number;
}

export interface GitDiffFile {
  path: string;
  original: string;
  modified: string;
}

export interface GitLogEntry {
  hash: string;
  message: string;
  author: string;
  date: string;
}

// === Worktree ドメイン型 ===

export interface WorktreeInfo {
  id: string;
  path: string;
  branch: string;
  isMain: boolean;
}

// === 接続状態 ===

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting";
