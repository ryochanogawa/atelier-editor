import { create, type StateCreator } from "zustand";
import type {
  ConnectionStatus,
  WorkspaceInfo,
  TreeEntry,
  FileContent,
  GitStatusEntry,
  GitBranch,
  GitLogEntry,
  GitDiffFile,
  WorktreeInfo,
  CommissionDefinition,
  CommissionStatus,
} from "@/lib/rpc/types";

// === Connection Slice ===

interface ConnectionSlice {
  status: ConnectionStatus;
  workspaceInfo: WorkspaceInfo | null;
  setStatus: (status: ConnectionStatus) => void;
  setWorkspaceInfo: (info: WorkspaceInfo) => void;
}

const createConnectionSlice: StateCreator<WorkspaceStore, [], [], ConnectionSlice> = (
  set
) => ({
  status: "disconnected",
  workspaceInfo: null,
  setStatus: (status) => set({ status }),
  setWorkspaceInfo: (info) => set({ workspaceInfo: info }),
});

// === Tree Slice ===

interface TreeSlice {
  tree: TreeEntry[];
  expandedPaths: Set<string>;
  setTree: (tree: TreeEntry[]) => void;
  toggleExpand: (path: string) => void;
  setExpanded: (path: string, expanded: boolean) => void;
}

const createTreeSlice: StateCreator<WorkspaceStore, [], [], TreeSlice> = (set) => ({
  tree: [],
  expandedPaths: new Set<string>(),
  setTree: (tree) => set({ tree }),
  toggleExpand: (path) =>
    set((state) => {
      const next = new Set(state.expandedPaths);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return { expandedPaths: next };
    }),
  setExpanded: (path, expanded) =>
    set((state) => {
      const next = new Set(state.expandedPaths);
      if (expanded) {
        next.add(path);
      } else {
        next.delete(path);
      }
      return { expandedPaths: next };
    }),
});

// === Files Slice ===

export interface OpenFile {
  path: string;
  content: string;
  originalContent: string;
  language: string;
}

interface FilesSlice {
  openFiles: Map<string, OpenFile>;
  openFile: (file: FileContent) => void;
  updateContent: (path: string, content: string) => void;
  markSaved: (path: string) => void;
  closeFile: (path: string) => void;
  reloadFile: (path: string, content: string) => void;
}

const createFilesSlice: StateCreator<WorkspaceStore, [], [], FilesSlice> = (
  set,
  get
) => ({
  openFiles: new Map<string, OpenFile>(),
  openFile: (file) =>
    set((state) => {
      const next = new Map(state.openFiles);
      if (!next.has(file.path)) {
        next.set(file.path, {
          path: file.path,
          content: file.content,
          originalContent: file.content,
          language: file.language ?? "plaintext",
        });
      }
      return { openFiles: next };
    }),
  updateContent: (path, content) =>
    set((state) => {
      const existing = state.openFiles.get(path);
      if (!existing) return state;
      const next = new Map(state.openFiles);
      next.set(path, { ...existing, content });
      return { openFiles: next };
    }),
  markSaved: (path) =>
    set((state) => {
      const existing = state.openFiles.get(path);
      if (!existing) return state;
      const next = new Map(state.openFiles);
      next.set(path, { ...existing, originalContent: existing.content });
      return { openFiles: next };
    }),
  closeFile: (path) => {
    const state = get();
    const next = new Map(state.openFiles);
    next.delete(path);

    const updates: Partial<WorkspaceStore> = { openFiles: next };

    // タブも連動して閉じる
    const tabOrder = state.tabOrder.filter((t) => t !== path);
    updates.tabOrder = tabOrder;

    if (state.activeTab === path) {
      updates.activeTab = tabOrder.length > 0 ? tabOrder[0] : null;
    }

    set(updates);
  },
  reloadFile: (path, content) =>
    set((state) => {
      const existing = state.openFiles.get(path);
      if (!existing) return state;
      // dirty でなければ自動更新
      if (existing.content === existing.originalContent) {
        const next = new Map(state.openFiles);
        next.set(path, { ...existing, content, originalContent: content });
        return { openFiles: next };
      }
      return state;
    }),
});

// === Tabs Slice ===

interface TabsSlice {
  activeTab: string | null;
  tabOrder: string[];
  setActiveTab: (path: string) => void;
  addTab: (path: string) => void;
  removeTab: (path: string) => void;
}

const createTabsSlice: StateCreator<WorkspaceStore, [], [], TabsSlice> = (set) => ({
  activeTab: null,
  tabOrder: [],
  setActiveTab: (path) => set({ activeTab: path }),
  addTab: (path) =>
    set((state) => {
      if (state.tabOrder.includes(path)) {
        return { activeTab: path };
      }
      return { tabOrder: [...state.tabOrder, path], activeTab: path };
    }),
  removeTab: (path) =>
    set((state) => {
      const tabOrder = state.tabOrder.filter((t) => t !== path);
      const activeTab =
        state.activeTab === path
          ? tabOrder.length > 0
            ? tabOrder[Math.max(0, state.tabOrder.indexOf(path) - 1)]
            : null
          : state.activeTab;
      return { tabOrder, activeTab };
    }),
});

// === Cursor Slice ===

interface CursorSlice {
  cursorPosition: { line: number; column: number } | null;
  setCursorPosition: (pos: { line: number; column: number }) => void;
}

const createCursorSlice: StateCreator<WorkspaceStore, [], [], CursorSlice> = (
  set
) => ({
  cursorPosition: null,
  setCursorPosition: (pos) => set({ cursorPosition: pos }),
});

// === Git Slice ===

interface GitSlice {
  gitStatus: GitStatusEntry[];
  branches: GitBranch[];
  currentBranch: GitBranch | null;
  commitLog: GitLogEntry[];
  diffFile: GitDiffFile | null;

  setGitStatus: (entries: GitStatusEntry[]) => void;
  setBranches: (branches: GitBranch[]) => void;
  setCommitLog: (entries: GitLogEntry[]) => void;
  setDiffFile: (diff: GitDiffFile | null) => void;
  clearGitState: () => void;
}

const createGitSlice: StateCreator<WorkspaceStore, [], [], GitSlice> = (set) => ({
  gitStatus: [],
  branches: [],
  currentBranch: null,
  commitLog: [],
  diffFile: null,

  setGitStatus: (gitStatus) => set({ gitStatus }),
  setBranches: (branches) =>
    set({
      branches,
      currentBranch: branches.find((b) => b.current) ?? null,
    }),
  setCommitLog: (commitLog) => set({ commitLog }),
  setDiffFile: (diffFile) => set({ diffFile }),
  clearGitState: () =>
    set({
      gitStatus: [],
      branches: [],
      currentBranch: null,
      commitLog: [],
      diffFile: null,
    }),
});

// === Studio Slice ===

interface StudioSlice {
  worktrees: WorktreeInfo[];
  activeWorktreeId: string | null;

  setWorktrees: (list: WorktreeInfo[]) => void;
  setActiveWorktreeId: (id: string) => void;
  clearStudioState: () => void;
}

const createStudioSlice: StateCreator<WorkspaceStore, [], [], StudioSlice> = (
  set
) => ({
  worktrees: [],
  activeWorktreeId: null,

  setWorktrees: (worktrees) => set({ worktrees }),
  setActiveWorktreeId: (activeWorktreeId) => set({ activeWorktreeId }),
  clearStudioState: () =>
    set({ worktrees: [], activeWorktreeId: null }),
});

// === Sidebar Slice ===

export type SidebarView = "files" | "git" | "commission";

interface SidebarSlice {
  sidebarView: SidebarView;
  setSidebarView: (view: SidebarView) => void;
}

const createSidebarSlice: StateCreator<WorkspaceStore, [], [], SidebarSlice> = (
  set
) => ({
  sidebarView: "files",
  setSidebarView: (sidebarView) => set({ sidebarView }),
});

// === Toast Slice ===

export interface Toast {
  id: string;
  message: string;
  type: "info" | "error" | "success";
}

interface ToastSlice {
  toasts: Toast[];
  addToast: (message: string, type: Toast["type"]) => void;
  removeToast: (id: string) => void;
}

const createToastSlice: StateCreator<WorkspaceStore, [], [], ToastSlice> = (
  set
) => ({
  toasts: [],
  addToast: (message, type) => {
    const id = crypto.randomUUID();
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }],
    }));
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 4000);
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
});

// === Terminal Slice ===

export interface TerminalSession {
  sessionId: string;
  active: boolean;
}

interface TerminalSlice {
  terminalSessions: TerminalSession[];
  activeTerminalId: string | null;
  terminalVisible: boolean;
  terminalHeight: number;

  addTerminalSession: (sessionId: string) => void;
  removeTerminalSession: (sessionId: string) => void;
  setActiveTerminalId: (id: string | null) => void;
  setTerminalVisible: (visible: boolean) => void;
  toggleTerminal: () => void;
  markTerminalExited: (sessionId: string) => void;
  setTerminalHeight: (height: number) => void;
}

const createTerminalSlice: StateCreator<WorkspaceStore, [], [], TerminalSlice> = (
  set
) => ({
  terminalSessions: [],
  activeTerminalId: null,
  terminalVisible: false,
  terminalHeight: 256,

  addTerminalSession: (sessionId) =>
    set((state) => ({
      terminalSessions: [...state.terminalSessions, { sessionId, active: true }],
      activeTerminalId: sessionId,
      terminalVisible: true,
    })),
  removeTerminalSession: (sessionId) =>
    set((state) => {
      const sessions = state.terminalSessions.filter((s) => s.sessionId !== sessionId);
      return {
        terminalSessions: sessions,
        activeTerminalId:
          state.activeTerminalId === sessionId
            ? sessions.length > 0
              ? sessions[sessions.length - 1].sessionId
              : null
            : state.activeTerminalId,
        terminalVisible: sessions.length > 0 ? state.terminalVisible : false,
      };
    }),
  setActiveTerminalId: (id) => set({ activeTerminalId: id }),
  setTerminalVisible: (visible) => set({ terminalVisible: visible }),
  toggleTerminal: () => set((state) => ({ terminalVisible: !state.terminalVisible })),
  markTerminalExited: (sessionId) =>
    set((state) => ({
      terminalSessions: state.terminalSessions.map((s) =>
        s.sessionId === sessionId ? { ...s, active: false } : s
      ),
    })),
  setTerminalHeight: (height) => set({ terminalHeight: height }),
});

// === Commission Slice ===

export interface CommissionLogEntry {
  phase: string;
  message: string;
  progress: number | null;
  timestamp: string;
}

export interface CommissionStroke {
  strokeId: string;
  strokeName: string;
  status: "running" | "completed" | "failed";
}

interface CommissionSlice {
  commissionDefinitions: CommissionDefinition[];
  activeCommissionId: string | null;
  commissionStatus: CommissionStatus | null;
  commissionLogs: CommissionLogEntry[];
  commissionStrokes: CommissionStroke[];
  commissionProgress: number | null;
  commissionResult: {
    status: "success" | "failure" | "aborted";
    changedFiles?: string[];
    summary?: string;
    error?: string;
  } | null;

  setCommissionDefinitions: (defs: CommissionDefinition[]) => void;
  startCommission: (commissionId: string) => void;
  addCommissionLog: (entry: CommissionLogEntry) => void;
  updateCommissionStroke: (stroke: CommissionStroke) => void;
  completeCommission: (result: CommissionSlice["commissionResult"]) => void;
  clearCommission: () => void;
}

const createCommissionSlice: StateCreator<WorkspaceStore, [], [], CommissionSlice> = (
  set
) => ({
  commissionDefinitions: [],
  activeCommissionId: null,
  commissionStatus: null,
  commissionLogs: [],
  commissionStrokes: [],
  commissionProgress: null,
  commissionResult: null,

  setCommissionDefinitions: (commissionDefinitions) => set({ commissionDefinitions }),
  startCommission: (commissionId) =>
    set({
      activeCommissionId: commissionId,
      commissionStatus: "running",
      commissionLogs: [],
      commissionStrokes: [],
      commissionProgress: null,
      commissionResult: null,
    }),
  addCommissionLog: (entry) =>
    set((state) => ({
      commissionLogs: [...state.commissionLogs, entry],
      commissionProgress: entry.progress ?? state.commissionProgress,
    })),
  updateCommissionStroke: (stroke) =>
    set((state) => {
      const existing = state.commissionStrokes.findIndex(
        (s) => s.strokeId === stroke.strokeId
      );
      if (existing >= 0) {
        const next = [...state.commissionStrokes];
        next[existing] = stroke;
        return { commissionStrokes: next };
      }
      return { commissionStrokes: [...state.commissionStrokes, stroke] };
    }),
  completeCommission: (result) =>
    set({
      commissionStatus: result?.status === "success" ? "completed" : result?.status === "aborted" ? "aborted" : "failed",
      commissionResult: result,
    }),
  clearCommission: () =>
    set({
      activeCommissionId: null,
      commissionStatus: null,
      commissionLogs: [],
      commissionStrokes: [],
      commissionProgress: null,
      commissionResult: null,
    }),
});

// === 統合 Store ===

export type WorkspaceStore = ConnectionSlice &
  TreeSlice &
  FilesSlice &
  TabsSlice &
  CursorSlice &
  GitSlice &
  StudioSlice &
  SidebarSlice &
  ToastSlice &
  TerminalSlice &
  CommissionSlice;

export const useWorkspaceStore = create<WorkspaceStore>()((...a) => ({
  ...createConnectionSlice(...a),
  ...createTreeSlice(...a),
  ...createFilesSlice(...a),
  ...createTabsSlice(...a),
  ...createCursorSlice(...a),
  ...createGitSlice(...a),
  ...createStudioSlice(...a),
  ...createSidebarSlice(...a),
  ...createToastSlice(...a),
  ...createTerminalSlice(...a),
  ...createCommissionSlice(...a),
}));
