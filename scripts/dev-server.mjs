import { WebSocketServer } from "ws";
import { execFile, spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { createRequire } from "node:module";
import crypto from "node:crypto";
import net from "node:net";

const require = createRequire(import.meta.url);
const pty = require("node-pty");

const execFileAsync = promisify(execFile);

const PORT = 4000;

// ワークスペースルート（dev-server 起動ディレクトリ）
const WORKSPACE_ROOT = process.cwd();

// Git コマンド実行ヘルパー
async function git(args, cwd = WORKSPACE_ROOT) {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout;
}

// パスをワークスペースルート内に制限
function safePath(userPath) {
  const resolved = path.resolve(WORKSPACE_ROOT, userPath);
  if (!resolved.startsWith(WORKSPACE_ROOT)) {
    throw { code: -32602, message: "Path outside workspace" };
  }
  return resolved;
}

// Worktree 管理用の状態
let activeWorktreeId = "main";

// ファイルツリー構築
function buildTree(filePaths) {
  const root = [];
  const dirs = new Map();

  for (const filePath of filePaths.sort()) {
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
    name: path.basename(WORKSPACE_ROOT),
    rootPath: WORKSPACE_ROOT,
  }),

  "fs.readTree": async (_params) => {
    const stdout = await git(["ls-files", "--cached", "--others", "--exclude-standard"]);
    const filePaths = stdout.trim().split("\n").filter(Boolean);
    return buildTree(filePaths);
  },

  "fs.readFile": async (params) => {
    const absPath = safePath(params.path);
    try {
      const content = await readFile(absPath, "utf-8");
      return {
        path: params.path,
        content,
        encoding: "utf-8",
        language: guessLanguage(params.path),
      };
    } catch (err) {
      throw { code: -32602, message: `File not found: ${params.path}` };
    }
  },

  "fs.writeFile": async (params, ws, wss) => {
    const absPath = safePath(params.path);
    const isNew = await readFile(absPath).then(() => false, () => true);

    await writeFile(absPath, params.content, "utf-8");

    // fs.watch 通知をブロードキャスト（送信元を除外）
    const notification = JSON.stringify({
      jsonrpc: "2.0",
      method: "fs.watch",
      params: { path: params.path, type: isNew ? "create" : "change" },
    });
    for (const client of wss.clients) {
      if (client !== ws && client.readyState === 1) {
        client.send(notification);
      }
    }

    return { success: true };
  },
};

function guessLanguage(filePath) {
  const ext = filePath.split(".").pop();
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

// === Git ハンドラ ===

function parseStatusLine(line) {
  if (!line) return null;
  const x = line[0]; // index status
  const y = line[1]; // working tree status
  const filePath = line.slice(3);

  let status;
  const staged = x !== " " && x !== "?";

  if (x === "?" || y === "?") status = "untracked";
  else if (x === "A" || y === "A") status = "added";
  else if (x === "D" || y === "D") status = "deleted";
  else if (x === "R" || y === "R") status = "renamed";
  else status = "modified";

  // Untracked files appear as both staged=false entries
  if (x === "?") {
    return { path: filePath, status: "untracked", staged: false };
  }

  const entries = [];
  // Index (staged) changes
  if (x !== " " && x !== "?") {
    let indexStatus;
    if (x === "A") indexStatus = "added";
    else if (x === "D") indexStatus = "deleted";
    else if (x === "R") indexStatus = "renamed";
    else indexStatus = "modified";
    entries.push({ path: filePath, status: indexStatus, staged: true });
  }
  // Working tree (unstaged) changes
  if (y !== " " && y !== "?") {
    let wtStatus;
    if (y === "A") wtStatus = "added";
    else if (y === "D") wtStatus = "deleted";
    else if (y === "R") wtStatus = "renamed";
    else wtStatus = "modified";
    entries.push({ path: filePath, status: wtStatus, staged: false });
  }

  return entries.length === 1 ? entries[0] : entries;
}

const gitHandlers = {
  "git.status": async (_params) => {
    const stdout = await git(["status", "--porcelain=v1"]);
    const entries = [];
    for (const line of stdout.split("\n")) {
      const parsed = parseStatusLine(line);
      if (!parsed) continue;
      if (Array.isArray(parsed)) {
        entries.push(...parsed);
      } else {
        entries.push(parsed);
      }
    }
    return entries;
  },

  "git.branches": async (_params) => {
    const stdout = await git([
      "branch",
      "-vv",
      "--format=%(HEAD)%(refname:short)\t%(upstream:short)\t%(upstream:track)",
    ]);
    const branches = [];
    for (const line of stdout.trim().split("\n")) {
      if (!line) continue;
      const current = line[0] === "*";
      const rest = line.slice(1);
      const [name, remote, track] = rest.split("\t");

      let ahead = 0;
      let behind = 0;
      if (track) {
        const aheadMatch = track.match(/ahead (\d+)/);
        const behindMatch = track.match(/behind (\d+)/);
        if (aheadMatch) ahead = parseInt(aheadMatch[1], 10);
        if (behindMatch) behind = parseInt(behindMatch[1], 10);
      }

      branches.push({
        name: name.trim(),
        current,
        remote: remote || undefined,
        ahead,
        behind,
      });
    }
    return branches;
  },

  "git.diff": async (params) => {
    const filePath = params.path;
    let original = "";
    let modified = "";

    try {
      original = await git(["show", `HEAD:${filePath}`]);
    } catch {
      // New file — no original
    }

    try {
      const absPath = safePath(filePath);
      modified = await readFile(absPath, "utf-8");
    } catch {
      // Deleted file — no modified
    }

    return { path: filePath, original, modified };
  },

  "git.stage": async (params, _ws, wss) => {
    await git(["add", "--", ...params.paths]);
    broadcastNotification(wss, "git.changed", {
      worktreeId: activeWorktreeId,
      type: "status",
    });
    return { success: true };
  },

  "git.unstage": async (params, _ws, wss) => {
    await git(["restore", "--staged", "--", ...params.paths]);
    broadcastNotification(wss, "git.changed", {
      worktreeId: activeWorktreeId,
      type: "status",
    });
    return { success: true };
  },

  "git.commit": async (params, _ws, wss) => {
    const stdout = await git(["commit", "-m", params.message]);
    const hashMatch = stdout.match(/\[[\w/.-]+ ([a-f0-9]+)\]/);
    const hash = hashMatch ? hashMatch[1] : "unknown";
    broadcastNotification(wss, "git.changed", {
      worktreeId: activeWorktreeId,
      type: "commit",
    });
    return { hash };
  },

  "git.push": async (_params, _ws, wss) => {
    await git(["push"]);
    broadcastNotification(wss, "git.changed", {
      worktreeId: activeWorktreeId,
      type: "branch",
    });
    return { success: true };
  },

  "git.log": async (params) => {
    const limit = params.limit ?? 50;
    const stdout = await git([
      "log",
      `--format=%H%n%s%n%an%n%aI`,
      `-n`,
      String(limit),
    ]);
    const lines = stdout.trim().split("\n");
    const entries = [];
    for (let i = 0; i + 3 < lines.length; i += 4) {
      entries.push({
        hash: lines[i],
        message: lines[i + 1],
        author: lines[i + 2],
        date: lines[i + 3],
      });
    }
    return entries;
  },
};

// === Studio (Worktree) ハンドラ ===

const studioHandlers = {
  "studio.list": async (_params) => {
    const stdout = await git(["worktree", "list", "--porcelain"]);
    const worktrees = [];
    let current = {};

    for (const line of stdout.split("\n")) {
      if (line.startsWith("worktree ")) {
        current = { path: line.slice(9) };
      } else if (line.startsWith("HEAD ")) {
        current.head = line.slice(5);
      } else if (line.startsWith("branch ")) {
        current.branch = line.slice(7).replace("refs/heads/", "");
      } else if (line === "bare") {
        current.bare = true;
      } else if (line === "") {
        if (current.path && !current.bare) {
          const isMain = current.path === WORKSPACE_ROOT;
          worktrees.push({
            id: isMain ? "main" : path.basename(current.path),
            path: current.path,
            branch: current.branch ?? "detached",
            isMain,
          });
        }
        current = {};
      }
    }

    return worktrees;
  },

  "studio.create": async (params, _ws, wss) => {
    const worktreePath = path.join(WORKSPACE_ROOT, ".worktrees", params.branch);
    await git(["worktree", "add", worktreePath, "-b", params.branch]);
    const info = {
      id: params.branch,
      path: worktreePath,
      branch: params.branch,
      isMain: false,
    };
    broadcastNotification(wss, "studio.changed", {
      type: "created",
      worktreeId: params.branch,
    });
    return info;
  },

  "studio.switch": async (params, _ws, wss) => {
    activeWorktreeId = params.worktreeId;
    broadcastNotification(wss, "studio.changed", {
      type: "switched",
      worktreeId: params.worktreeId,
    });
    return { success: true };
  },

  "studio.remove": async (params, _ws, wss) => {
    // main は削除不可
    if (params.worktreeId === "main") {
      throw { code: -32602, message: "Cannot remove main worktree" };
    }
    const worktreePath = path.join(
      WORKSPACE_ROOT,
      ".worktrees",
      params.worktreeId
    );
    await git(["worktree", "remove", worktreePath, "--force"]);
    broadcastNotification(wss, "studio.changed", {
      type: "removed",
      worktreeId: params.worktreeId,
    });
    return { success: true };
  },
};

// === Terminal (PTY) ハンドラ ===

// セッション管理: sessionId -> { pty, ws (owner client) }
const terminalSessions = new Map();

const terminalHandlers = {
  "terminal.create": (params, ws, wss) => {
    const sessionId = crypto.randomUUID();
    const shell = params.shell || (process.platform === "win32" ? "powershell.exe" : process.env.SHELL || "/bin/bash");
    const cols = params.cols || 80;
    const rows = params.rows || 24;

    const ptyProcess = pty.spawn(shell, [], {
      name: "xterm-256color",
      cols,
      rows,
      cwd: WORKSPACE_ROOT,
      env: { ...process.env, TERM: "xterm-256color" },
    });

    ptyProcess.onData((data) => {
      // ターミナル出力をオーナークライアントに送信
      const notification = JSON.stringify({
        jsonrpc: "2.0",
        method: "terminal.output",
        params: { sessionId, data },
      });
      if (ws.readyState === 1) {
        ws.send(notification);
      }
    });

    ptyProcess.onExit(({ exitCode }) => {
      const notification = JSON.stringify({
        jsonrpc: "2.0",
        method: "terminal.exit",
        params: { sessionId, exitCode },
      });
      if (ws.readyState === 1) {
        ws.send(notification);
      }
      terminalSessions.delete(sessionId);
    });

    terminalSessions.set(sessionId, { pty: ptyProcess, ws });
    console.log(`[dev-server] Terminal created: ${sessionId} (shell: ${shell})`);

    return { sessionId };
  },

  "terminal.input": (params) => {
    const session = terminalSessions.get(params.sessionId);
    if (!session) {
      throw { code: -32602, message: `Terminal session not found: ${params.sessionId}` };
    }
    session.pty.write(params.data);
    return { success: true };
  },

  "terminal.resize": (params) => {
    const session = terminalSessions.get(params.sessionId);
    if (!session) {
      throw { code: -32602, message: `Terminal session not found: ${params.sessionId}` };
    }
    session.pty.resize(params.cols, params.rows);
    return { success: true };
  },

  "terminal.kill": (params) => {
    const session = terminalSessions.get(params.sessionId);
    if (!session) {
      throw { code: -32602, message: `Terminal session not found: ${params.sessionId}` };
    }
    session.pty.kill();
    terminalSessions.delete(params.sessionId);
    console.log(`[dev-server] Terminal killed: ${params.sessionId}`);
    return { success: true };
  },
};

// === Preview (Dev Server) ハンドラ ===

// dev server 状態管理
let devServerProcess = null;
let devServerStatus = "stopped"; // stopped | starting | running | error
let devServerPort = null;
let devServerUrl = null;
let devServerIdleTimer = null;
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

function resetIdleTimer(wss) {
  if (devServerIdleTimer) clearTimeout(devServerIdleTimer);
  if (devServerStatus === "running") {
    devServerIdleTimer = setTimeout(() => {
      console.log("[dev-server] Idle timeout — stopping preview dev server");
      stopDevServer(wss);
    }, IDLE_TIMEOUT_MS);
  }
}

async function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

async function startDevServer(wss) {
  if (devServerProcess) {
    return { url: devServerUrl, port: devServerPort };
  }

  devServerStatus = "starting";
  broadcastNotification(wss, "preview.statusChange", {
    status: "starting",
    url: null,
    port: null,
  });

  try {
    const port = await findFreePort();
    devServerPort = port;

    const viteProcess = spawn("npx", ["vite", "--port", String(port), "--host", "localhost"], {
      cwd: WORKSPACE_ROOT,
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    });

    devServerProcess = viteProcess;

    let resolved = false;

    const readyPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          reject(new Error("Dev server startup timed out (5s)"));
        }
      }, 5000);

      function onData(data) {
        const line = data.toString();
        broadcastNotification(wss, "preview.log", {
          line: line.trim(),
          timestamp: new Date().toISOString(),
        });

        // Vite outputs "Local: http://localhost:PORT/" when ready
        const urlMatch = line.match(/Local:\s+(https?:\/\/[^\s]+)/);
        if (urlMatch && !resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve(urlMatch[1]);
        }
      }

      viteProcess.stdout.on("data", onData);
      viteProcess.stderr.on("data", (data) => {
        const line = data.toString();
        broadcastNotification(wss, "preview.log", {
          line: line.trim(),
          timestamp: new Date().toISOString(),
        });
      });

      viteProcess.on("error", (err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          reject(err);
        }
      });

      viteProcess.on("exit", (code) => {
        devServerProcess = null;
        devServerStatus = "stopped";
        devServerPort = null;
        devServerUrl = null;
        if (devServerIdleTimer) clearTimeout(devServerIdleTimer);

        broadcastNotification(wss, "preview.statusChange", {
          status: code === 0 || code === null ? "stopped" : "error",
          url: null,
          port: null,
          ...(code !== 0 && code !== null ? { error: `Process exited with code ${code}` } : {}),
        });

        if (!resolved) {
          resolved = true;
          reject(new Error(`Dev server exited with code ${code}`));
        }
      });
    });

    const url = await readyPromise;
    devServerUrl = url;
    devServerStatus = "running";

    broadcastNotification(wss, "preview.statusChange", {
      status: "running",
      url,
      port,
    });

    resetIdleTimer(wss);
    console.log(`[dev-server] Preview dev server running at ${url}`);

    return { url, port };
  } catch (err) {
    devServerStatus = "error";
    if (devServerProcess) {
      devServerProcess.kill();
      devServerProcess = null;
    }
    devServerPort = null;
    devServerUrl = null;

    broadcastNotification(wss, "preview.statusChange", {
      status: "error",
      url: null,
      port: null,
      error: err.message,
    });

    throw { code: -32603, message: `Failed to start dev server: ${err.message}` };
  }
}

function stopDevServer(wss) {
  if (devServerIdleTimer) {
    clearTimeout(devServerIdleTimer);
    devServerIdleTimer = null;
  }

  if (devServerProcess) {
    devServerProcess.kill();
    devServerProcess = null;
  }

  devServerStatus = "stopped";
  devServerPort = null;
  devServerUrl = null;

  broadcastNotification(wss, "preview.statusChange", {
    status: "stopped",
    url: null,
    port: null,
  });

  console.log("[dev-server] Preview dev server stopped");
  return { success: true };
}

const previewHandlers = {
  "preview.start": async (_params, _ws, wss) => {
    resetIdleTimer(wss);
    return await startDevServer(wss);
  },

  "preview.stop": (_params, _ws, wss) => {
    return stopDevServer(wss);
  },

  "preview.status": () => {
    return {
      status: devServerStatus,
      url: devServerUrl,
      port: devServerPort,
    };
  },
};

// === Commission ハンドラ ===

const mockCommissionDefinitions = [
  {
    name: "code-review",
    description: "AI-powered code review for the current worktree changes",
    params: {
      scope: { type: "string", description: "Review scope (all, staged, file)", default: "all" },
      severity: { type: "string", description: "Minimum severity level", enum: ["info", "warning", "error"], default: "info" },
    },
  },
  {
    name: "generate-tests",
    description: "Generate unit tests for modified files",
    params: {
      framework: { type: "string", description: "Test framework to use", required: true },
      coverage: { type: "number", description: "Target coverage percentage", default: 80 },
    },
  },
  {
    name: "refactor",
    description: "AI-assisted refactoring of selected code",
    params: {
      strategy: { type: "string", description: "Refactoring strategy", enum: ["extract", "inline", "rename"], required: true },
    },
  },
];

const activeCommissions = new Map();

const commissionHandlers = {
  "commission.list": (_params) => {
    return mockCommissionDefinitions;
  },

  "commission.run": (params, ws, wss) => {
    const commissionId = `comm_${crypto.randomUUID().slice(0, 8)}`;
    const commission = {
      id: commissionId,
      name: params.commissionName,
      status: "running",
      ws,
    };
    activeCommissions.set(commissionId, commission);

    // 進捗通知のシミュレーション
    simulateCommissionProgress(wss, commissionId, params.commissionName);

    return { commissionId };
  },

  "commission.abort": (params) => {
    const commission = activeCommissions.get(params.commissionId);
    if (!commission) {
      throw { code: -32602, message: "Commission not found" };
    }
    commission.status = "aborted";
    return { success: true };
  },

  "commission.status": (params) => {
    const commission = activeCommissions.get(params.commissionId);
    if (!commission) {
      throw { code: -32602, message: "Commission not found" };
    }
    return {
      commissionId: params.commissionId,
      status: commission.status,
      phase: commission.phase ?? null,
      progress: commission.progress ?? null,
    };
  },
};

function simulateCommissionProgress(wss, commissionId, commissionName) {
  const phases = [
    { phase: "analyzing", messages: ["Analyzing workspace...", "Scanning files...", "Building dependency graph..."], duration: 1500 },
    { phase: "generating", messages: ["Generating changes...", `Running ${commissionName}...`, "Processing results..."], duration: 2000 },
    { phase: "applying", messages: ["Applying changes...", "Writing files...", "Verifying output..."], duration: 1000 },
  ];

  const strokes = [
    { strokeId: "stroke_1", strokeName: "Analysis", delay: 200 },
    { strokeId: "stroke_2", strokeName: "Generation", delay: 1800 },
    { strokeId: "stroke_3", strokeName: "Application", delay: 3800 },
  ];

  let totalDelay = 0;
  let messageIndex = 0;
  const totalMessages = phases.reduce((sum, p) => sum + p.messages.length, 0);

  // Stroke通知
  for (const stroke of strokes) {
    setTimeout(() => {
      const commission = activeCommissions.get(commissionId);
      if (!commission || commission.status === "aborted") return;
      broadcastNotification(wss, "commission.stroke", {
        commissionId,
        strokeId: stroke.strokeId,
        strokeName: stroke.strokeName,
        status: "running",
      });
    }, stroke.delay);
  }

  // Phase/Progress通知
  for (const phase of phases) {
    const msgInterval = phase.duration / phase.messages.length;
    for (const message of phase.messages) {
      const delay = totalDelay;
      const progress = Math.round((messageIndex / totalMessages) * 100);
      setTimeout(() => {
        const commission = activeCommissions.get(commissionId);
        if (!commission || commission.status === "aborted") {
          if (commission?.status === "aborted") {
            broadcastNotification(wss, "commission.completed", {
              commissionId,
              status: "aborted",
            });
            activeCommissions.delete(commissionId);
          }
          return;
        }
        commission.phase = phase.phase;
        commission.progress = progress;
        broadcastNotification(wss, "commission.progress", {
          commissionId,
          phase: phase.phase,
          message,
          progress,
          timestamp: new Date().toISOString(),
        });
      }, delay);
      totalDelay += msgInterval;
      messageIndex++;
    }
  }

  // Stroke完了通知
  setTimeout(() => {
    const commission = activeCommissions.get(commissionId);
    if (!commission || commission.status === "aborted") return;
    for (const stroke of strokes) {
      broadcastNotification(wss, "commission.stroke", {
        commissionId,
        strokeId: stroke.strokeId,
        strokeName: stroke.strokeName,
        status: "completed",
      });
    }
  }, totalDelay - 200);

  // 完了通知
  setTimeout(() => {
    const commission = activeCommissions.get(commissionId);
    if (!commission || commission.status === "aborted") return;
    commission.status = "completed";
    broadcastNotification(wss, "commission.completed", {
      commissionId,
      status: "success",
      result: {
        changedFiles: ["src/components/Example.tsx", "src/utils/helper.ts", "src/__tests__/example.test.ts"],
        summary: `${commissionName} completed successfully. 3 files changed.`,
      },
    });
    activeCommissions.delete(commissionId);
  }, totalDelay + 500);
}

// === Chat ハンドラ ===

const activeChatStreams = new Map(); // chatId -> { aborted }

const chatHandlers = {
  "chat.send": (params, ws, wss) => {
    const { chatId, message, context } = params;
    const messageId = `msg_${crypto.randomUUID().slice(0, 8)}`;

    // Abort any previous stream for this chat
    const prev = activeChatStreams.get(chatId);
    if (prev) prev.aborted = true;

    const state = { aborted: false };
    activeChatStreams.set(chatId, state);

    // Simulate AI response asynchronously
    simulateChatResponse(ws, chatId, messageId, message, context, state);

    return { messageId };
  },

  "chat.abort": (params) => {
    const state = activeChatStreams.get(params.chatId);
    if (state) {
      state.aborted = true;
      activeChatStreams.delete(params.chatId);
    }
    return { success: true };
  },
};

function simulateChatResponse(ws, chatId, messageId, userMessage, context, state) {
  // Generate a contextual mock response
  const activeFile = context?.activeFile?.path ?? "unknown file";
  const language = context?.activeFile?.language ?? "code";

  const mockResponses = [
    {
      text: `I can see you're working on \`${activeFile}\`. Here's a suggestion to improve the code:\n\nThe current implementation can be optimized by extracting the repeated logic into a helper function.\n\n\`\`\`${language}\n// Refactored helper\nfunction processItems(items) {\n  return items\n    .filter(item => item.active)\n    .map(item => ({\n      ...item,\n      processed: true,\n    }));\n}\n\`\`\`\n\nThis approach reduces duplication and improves readability.`,
      codeChange: context?.activeFile ? {
        filePath: activeFile,
        original: (context.activeFile.content ?? "").split("\n").slice(0, 10).join("\n"),
        modified: (context.activeFile.content ?? "").split("\n").slice(0, 10).join("\n") + "\n\n// AI-suggested improvement\n// TODO: Implement optimization",
      } : null,
    },
    {
      text: `Based on the cursor position and the file \`${activeFile}\`, here are my observations:\n\n1. **Code structure** looks good overall\n2. Consider adding error handling for edge cases\n3. The function could benefit from type annotations\n\n\`\`\`${language}\ntry {\n  const result = await processData(input);\n  return result;\n} catch (error) {\n  console.error('Processing failed:', error);\n  throw new Error('Failed to process data');\n}\n\`\`\``,
      codeChange: null,
    },
    {
      text: `Looking at your ${language} code in \`${activeFile}\`, I'd recommend the following changes:\n\n- Add input validation at the function boundary\n- Use early returns to reduce nesting\n- Consider extracting magic numbers into named constants\n\nHere's an improved version:\n\n\`\`\`${language}\nconst MAX_RETRIES = 3;\nconst TIMEOUT_MS = 5000;\n\nexport function fetchWithRetry(url, options = {}) {\n  if (!url) throw new Error('URL is required');\n  \n  return retry(() => fetch(url, {\n    ...options,\n    signal: AbortSignal.timeout(TIMEOUT_MS),\n  }), MAX_RETRIES);\n}\n\`\`\``,
      codeChange: context?.activeFile ? {
        filePath: activeFile,
        original: (context.activeFile.content ?? "").split("\n").slice(0, 5).join("\n"),
        modified: "// Enhanced with validation and constants\n" + (context.activeFile.content ?? "").split("\n").slice(0, 5).join("\n"),
      } : null,
    },
  ];

  const response = mockResponses[Math.floor(Math.random() * mockResponses.length)];
  const tokens = response.text.split(/(?<=\s)/); // Split on whitespace boundaries

  let tokenIndex = 0;
  const interval = setInterval(() => {
    if (state.aborted || ws.readyState !== 1) {
      clearInterval(interval);
      if (ws.readyState === 1 && !state.aborted) {
        sendNotification(ws, "chat.stream", { chatId, messageId, delta: "", done: true });
      }
      activeChatStreams.delete(chatId);
      return;
    }

    if (tokenIndex < tokens.length) {
      // Send 1-3 tokens at a time for realistic streaming
      const chunk = tokens.slice(tokenIndex, tokenIndex + Math.ceil(Math.random() * 3)).join("");
      tokenIndex += Math.ceil(Math.random() * 3);
      sendNotification(ws, "chat.stream", { chatId, messageId, delta: chunk, done: false });
    } else {
      clearInterval(interval);
      sendNotification(ws, "chat.stream", { chatId, messageId, delta: "", done: true });

      // Send code change proposal after stream completes
      if (response.codeChange) {
        const changeId = `change_${crypto.randomUUID().slice(0, 8)}`;
        setTimeout(() => {
          if (ws.readyState === 1 && !state.aborted) {
            sendNotification(ws, "chat.codeChange", {
              chatId,
              messageId,
              changeId,
              filePath: response.codeChange.filePath,
              original: response.codeChange.original,
              modified: response.codeChange.modified,
            });
          }
        }, 300);
      }

      activeChatStreams.delete(chatId);
    }
  }, 30 + Math.random() * 50); // 30-80ms per chunk
}

function sendNotification(ws, method, params) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify({ jsonrpc: "2.0", method, params }));
  }
}

function broadcastNotification(wss, method, params) {
  const msg = JSON.stringify({ jsonrpc: "2.0", method, params });
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(msg);
    }
  }
}

// サーバー起動
const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (ws) => {
  console.log("[dev-server] Client connected");

  ws.on("message", async (raw) => {
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

    const allHandlers = { ...handlers, ...gitHandlers, ...studioHandlers, ...terminalHandlers, ...previewHandlers, ...commissionHandlers, ...chatHandlers };
    const handler = allHandlers[method];
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
      const result = await handler(params ?? {}, ws, wss);
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
    // クライアント切断時にそのクライアントが所有するターミナルセッションをクリーンアップ
    for (const [sessionId, session] of terminalSessions) {
      if (session.ws === ws) {
        session.pty.kill();
        terminalSessions.delete(sessionId);
        console.log(`[dev-server] Terminal cleaned up on disconnect: ${sessionId}`);
      }
    }
    console.log("[dev-server] Client disconnected");
  });
});

// クリーンアップ: プロセス終了時にdev serverを停止
process.on("SIGINT", () => {
  if (devServerProcess) {
    devServerProcess.kill();
  }
  process.exit(0);
});

process.on("SIGTERM", () => {
  if (devServerProcess) {
    devServerProcess.kill();
  }
  process.exit(0);
});

console.log(`[dev-server] WebSocket server running on ws://localhost:${PORT}`);
