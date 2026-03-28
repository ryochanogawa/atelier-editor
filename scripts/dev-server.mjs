import { WebSocketServer } from "ws";

const PORT = 4000;

// インメモリファイルシステム
const fileSystem = {
  "src/index.ts": {
    content: `import { greet } from "./utils/greet";\n\nconst message = greet("ATELIER");\nconsole.log(message);\n`,
    language: "typescript",
  },
  "src/utils/greet.ts": {
    content: `export function greet(name: string): string {\n  return \`Hello, \${name}!\`;\n}\n`,
    language: "typescript",
  },
  "src/types.ts": {
    content: `export interface Config {\n  name: string;\n  version: string;\n  debug: boolean;\n}\n`,
    language: "typescript",
  },
  "package.json": {
    content: JSON.stringify(
      { name: "sample-project", version: "1.0.0", main: "src/index.ts" },
      null,
      2
    ),
    language: "json",
  },
  "README.md": {
    content: `# Sample Project\n\nThis is a sample project for ATELIER Editor development.\n`,
    language: "markdown",
  },
};

// ファイルツリー構築
function buildTree(files) {
  const root = [];
  const dirs = new Map();

  for (const filePath of Object.keys(files).sort()) {
    const parts = filePath.split("/");
    let currentPath = "";

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const parentPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${name}` : name;

      if (i === parts.length - 1) {
        // ファイル
        const entry = { name, path: currentPath, type: "file" };
        const parent = dirs.get(parentPath);
        if (parent) {
          parent.children.push(entry);
        } else {
          root.push(entry);
        }
      } else {
        // ディレクトリ
        if (!dirs.has(currentPath)) {
          const entry = { name, path: currentPath, type: "directory", children: [] };
          dirs.set(currentPath, entry);
          const parent = dirs.get(parentPath);
          if (parent) {
            parent.children.push(entry);
          } else {
            root.push(entry);
          }
        }
      }
    }
  }

  return root;
}

// RPC ハンドラ
const handlers = {
  "workspace.info": () => ({
    name: "sample-project",
    rootPath: "/workspace/sample-project",
  }),

  "fs.readTree": (_params) => buildTree(fileSystem),

  "fs.readFile": (params) => {
    const file = fileSystem[params.path];
    if (!file) {
      throw { code: -32602, message: `File not found: ${params.path}` };
    }
    return {
      path: params.path,
      content: file.content,
      encoding: "utf-8",
      language: file.language,
    };
  },

  "fs.writeFile": (params, ws, wss) => {
    const existing = fileSystem[params.path];
    const isNew = !existing;
    const language = existing?.language ?? guessLanguage(params.path);

    fileSystem[params.path] = {
      content: params.content,
      language,
    };

    // fs.watch 通知をブロードキャスト
    const notification = JSON.stringify({
      jsonrpc: "2.0",
      method: "fs.watch",
      params: {
        path: params.path,
        type: isNew ? "create" : "change",
      },
    });

    for (const client of wss.clients) {
      if (client !== ws && client.readyState === 1) {
        client.send(notification);
      }
    }

    return { success: true };
  },
};

function guessLanguage(path) {
  const ext = path.split(".").pop();
  const map = {
    ts: "typescript",
    tsx: "typescriptreact",
    js: "javascript",
    jsx: "javascriptreact",
    json: "json",
    md: "markdown",
    css: "css",
    html: "html",
  };
  return map[ext] ?? "plaintext";
}

// サーバー起動
const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (ws) => {
  console.log("[dev-server] Client connected");

  ws.on("message", (raw) => {
    let request;
    try {
      request = JSON.parse(raw.toString());
    } catch {
      ws.send(
        JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "Parse error" },
        })
      );
      return;
    }

    const { id, method, params } = request;
    console.log(`[dev-server] → ${method}`, params);

    const handler = handlers[method];
    if (!handler) {
      ws.send(
        JSON.stringify({
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Method not found: ${method}` },
        })
      );
      return;
    }

    try {
      const result = handler(params ?? {}, ws, wss);
      ws.send(JSON.stringify({ jsonrpc: "2.0", id, result }));
      console.log(`[dev-server] ← ${method} OK`);
    } catch (err) {
      const error =
        err && typeof err === "object" && "code" in err
          ? err
          : { code: -32603, message: String(err) };
      ws.send(JSON.stringify({ jsonrpc: "2.0", id, error }));
      console.log(`[dev-server] ← ${method} ERROR`, error);
    }
  });

  ws.on("close", () => {
    console.log("[dev-server] Client disconnected");
  });
});

console.log(`[dev-server] WebSocket server running on ws://localhost:${PORT}`);
