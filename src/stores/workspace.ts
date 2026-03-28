import { create, type StateCreator } from "zustand";
import type {
  ConnectionStatus,
  WorkspaceInfo,
  TreeEntry,
  FileContent,
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

// === 統合 Store ===

export type WorkspaceStore = ConnectionSlice &
  TreeSlice &
  FilesSlice &
  TabsSlice &
  CursorSlice;

export const useWorkspaceStore = create<WorkspaceStore>()((...a) => ({
  ...createConnectionSlice(...a),
  ...createTreeSlice(...a),
  ...createFilesSlice(...a),
  ...createTabsSlice(...a),
  ...createCursorSlice(...a),
}));
