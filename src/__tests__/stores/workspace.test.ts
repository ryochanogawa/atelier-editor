import { describe, it, expect, beforeEach } from "vitest";
import { useWorkspaceStore } from "@/stores/workspace";
import type { TreeEntry, FileContent } from "@/lib/rpc/types";

function getState() {
  return useWorkspaceStore.getState();
}

describe("workspace store", () => {
  // ── Connection Slice ──

  describe("ConnectionSlice", () => {
    it("has initial disconnected status", () => {
      expect(getState().status).toBe("disconnected");
    });

    it("setStatus updates status", () => {
      getState().setStatus("connected");
      expect(getState().status).toBe("connected");
    });

    it("setWorkspaceInfo stores workspace info", () => {
      const info = { name: "my-project", rootPath: "/home/user/project" };
      getState().setWorkspaceInfo(info);
      expect(getState().workspaceInfo).toEqual(info);
    });
  });

  // ── Tree Slice ──

  describe("TreeSlice", () => {
    const mockTree: TreeEntry[] = [
      {
        name: "src",
        path: "/src",
        type: "directory",
        children: [
          { name: "index.ts", path: "/src/index.ts", type: "file" },
        ],
      },
      { name: "README.md", path: "/README.md", type: "file" },
    ];

    it("setTree replaces tree", () => {
      getState().setTree(mockTree);
      expect(getState().tree).toEqual(mockTree);
    });

    it("toggleExpand adds path to expandedPaths", () => {
      getState().toggleExpand("/src");
      expect(getState().expandedPaths.has("/src")).toBe(true);
    });

    it("toggleExpand removes already expanded path", () => {
      getState().toggleExpand("/src");
      getState().toggleExpand("/src");
      expect(getState().expandedPaths.has("/src")).toBe(false);
    });

    it("setExpanded explicitly sets expansion state", () => {
      getState().setExpanded("/src", true);
      expect(getState().expandedPaths.has("/src")).toBe(true);

      getState().setExpanded("/src", false);
      expect(getState().expandedPaths.has("/src")).toBe(false);
    });
  });

  // ── Files Slice ──

  describe("FilesSlice", () => {
    const mockFile: FileContent = {
      path: "/src/index.ts",
      content: 'console.log("hello");',
      encoding: "utf-8",
      language: "typescript",
    };

    it("openFile adds file to openFiles", () => {
      getState().openFile(mockFile);
      const file = getState().openFiles.get(mockFile.path);
      expect(file).toBeDefined();
      expect(file!.content).toBe(mockFile.content);
      expect(file!.originalContent).toBe(mockFile.content);
      expect(file!.language).toBe("typescript");
    });

    it("openFile does not overwrite already open file", () => {
      getState().openFile(mockFile);
      getState().updateContent(mockFile.path, "modified");
      getState().openFile({ ...mockFile, content: "new content" });
      expect(getState().openFiles.get(mockFile.path)!.content).toBe("modified");
    });

    it("openFile defaults language to plaintext", () => {
      const noLang: FileContent = {
        path: "/file.txt",
        content: "text",
        encoding: "utf-8",
      };
      getState().openFile(noLang);
      expect(getState().openFiles.get("/file.txt")!.language).toBe("plaintext");
    });

    it("updateContent changes content but not originalContent", () => {
      getState().openFile(mockFile);
      getState().updateContent(mockFile.path, "updated");

      const file = getState().openFiles.get(mockFile.path)!;
      expect(file.content).toBe("updated");
      expect(file.originalContent).toBe(mockFile.content);
    });

    it("updateContent is no-op for unknown path", () => {
      const before = getState().openFiles;
      getState().updateContent("/unknown", "value");
      expect(getState().openFiles).toBe(before);
    });

    it("markSaved sets originalContent to current content", () => {
      getState().openFile(mockFile);
      getState().updateContent(mockFile.path, "saved");
      getState().markSaved(mockFile.path);

      const file = getState().openFiles.get(mockFile.path)!;
      expect(file.originalContent).toBe("saved");
    });

    it("closeFile removes file and associated tab", () => {
      getState().openFile(mockFile);
      getState().addTab(mockFile.path);
      getState().closeFile(mockFile.path);

      expect(getState().openFiles.has(mockFile.path)).toBe(false);
      expect(getState().tabOrder).not.toContain(mockFile.path);
    });

    it("closeFile sets activeTab to first remaining tab", () => {
      const file2: FileContent = { path: "/b.ts", content: "b", encoding: "utf-8", language: "typescript" };
      getState().openFile(mockFile);
      getState().addTab(mockFile.path);
      getState().openFile(file2);
      getState().addTab(file2.path);
      getState().setActiveTab(mockFile.path);

      getState().closeFile(mockFile.path);
      expect(getState().activeTab).toBe(file2.path);
    });

    it("reloadFile updates content when file is not dirty", () => {
      getState().openFile(mockFile);
      getState().reloadFile(mockFile.path, "reloaded");

      const file = getState().openFiles.get(mockFile.path)!;
      expect(file.content).toBe("reloaded");
      expect(file.originalContent).toBe("reloaded");
    });

    it("reloadFile does NOT update dirty file", () => {
      getState().openFile(mockFile);
      getState().updateContent(mockFile.path, "edited");
      getState().reloadFile(mockFile.path, "reloaded");

      expect(getState().openFiles.get(mockFile.path)!.content).toBe("edited");
    });
  });

  // ── Tabs Slice ──

  describe("TabsSlice", () => {
    it("initial state has no tabs", () => {
      expect(getState().activeTab).toBeNull();
      expect(getState().tabOrder).toEqual([]);
    });

    it("addTab adds path and sets it active", () => {
      getState().addTab("/a.ts");
      expect(getState().tabOrder).toEqual(["/a.ts"]);
      expect(getState().activeTab).toBe("/a.ts");
    });

    it("addTab does not duplicate existing path", () => {
      getState().addTab("/a.ts");
      getState().addTab("/b.ts");
      getState().addTab("/a.ts");
      expect(getState().tabOrder).toEqual(["/a.ts", "/b.ts"]);
      expect(getState().activeTab).toBe("/a.ts");
    });

    it("removeTab removes path and adjusts activeTab to previous", () => {
      getState().addTab("/a.ts");
      getState().addTab("/b.ts");
      getState().addTab("/c.ts");
      getState().setActiveTab("/b.ts");

      getState().removeTab("/b.ts");
      expect(getState().tabOrder).toEqual(["/a.ts", "/c.ts"]);
      expect(getState().activeTab).toBe("/a.ts");
    });

    it("removeTab sets null when last tab removed", () => {
      getState().addTab("/a.ts");
      getState().removeTab("/a.ts");
      expect(getState().activeTab).toBeNull();
      expect(getState().tabOrder).toEqual([]);
    });

    it("setActiveTab changes active tab", () => {
      getState().addTab("/a.ts");
      getState().addTab("/b.ts");
      getState().setActiveTab("/a.ts");
      expect(getState().activeTab).toBe("/a.ts");
    });
  });

  // ── Cursor Slice ──

  describe("CursorSlice", () => {
    it("initial cursorPosition is null", () => {
      expect(getState().cursorPosition).toBeNull();
    });

    it("setCursorPosition updates position", () => {
      getState().setCursorPosition({ line: 10, column: 5 });
      expect(getState().cursorPosition).toEqual({ line: 10, column: 5 });
    });
  });
});
