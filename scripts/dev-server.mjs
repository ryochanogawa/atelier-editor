import { WebSocketServer } from "ws";
import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { createRequire } from "node:module";
import crypto from "node:crypto";

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

// === Commission ハンドラ ===

const mockCommissions = [
  {
    name: "code-review",
    description: "AIによるコードレビューを実行します。変更されたファイルを分析し、改善提案を行います。",
    params: {
      scope: { type: "string", description: "レビュー対象のスコープ (all | staged | file)" },
    },
  },
  {
    name: "generate-tests",
    description: "指定されたファイルに対するテストコードを自動生成します。",
    params: {
      target: { type: "string", description: "テスト対象のファイルパス" },
      framework: { type: "string", description: "テストフレームワーク (vitest | jest)" },
    },
  },
  {
    name: "refactor",
    description: "コードのリファクタリングを提案・適用します。",
    params: {
      target: { type: "string", description: "リファクタリング対象のファイルパス" },
    },
  },
  {
    name: "documentation",
    description: "コードからドキュメントを自動生成します。",
    params: {},
  },
];

// 実行中のCommission管理
const runningCommissions = new Map();

const commissionHandlers = {
  "commission.list": (_params) => {
    return mockCommissions;
  },

  "commission.run": (params, ws, wss) => {
    const commissionId = `comm-${crypto.randomUUID().slice(0, 8)}`;
    const { commissionName } = params;

    const def = mockCommissions.find((c) => c.name === commissionName);
    if (!def) {
      throw { code: -32602, message: `Commission not found: ${commissionName}` };
    }

    runningCommissions.set(commissionId, { name: commissionName, status: "running", ws });

    // 非同期で進捗通知をシミュレーション
    simulateCommissionRun(commissionId, commissionName, ws, wss);

    return { commissionId };
  },

  "commission.abort": (params) => {
    const session = runningCommissions.get(params.commissionId);
    if (!session) {
      throw { code: -32602, message: `Commission not found: ${params.commissionId}` };
    }
    session.status = "aborted";
    return { success: true };
  },

  "commission.status": (params) => {
    const session = runningCommissions.get(params.commissionId);
    if (!session) {
      throw { code: -32602, message: `Commission not found: ${params.commissionId}` };
    }
    return {
      commissionId: params.commissionId,
      status: session.status,
      phase: session.phase ?? null,
      progress: session.progress ?? null,
    };
  },
};

function simulateCommissionRun(commissionId, commissionName, ws, wss) {
  const phases = [
    { phase: "analyzing", messages: ["Analyzing workspace...", "Scanning files...", "Building dependency graph..."], duration: 1500 },
    { phase: "generating", messages: ["Generating changes...", "Processing templates...", "Applying transformations..."], duration: 2000 },
    { phase: "applying", messages: ["Applying changes...", "Writing files...", "Validating results..."], duration: 1000 },
  ];

  const strokes = [
    { strokeId: "s1", strokeName: "File Analysis" },
    { strokeId: "s2", strokeName: "Code Generation" },
    { strokeId: "s3", strokeName: "Validation" },
  ];

  let totalMessages = phases.reduce((sum, p) => sum + p.messages.length, 0);
  let messageIndex = 0;
  let phaseIndex = 0;
  let msgInPhase = 0;

  function sendNotification(method, params) {
    const msg = JSON.stringify({ jsonrpc: "2.0", method, params });
    if (ws.readyState === 1) {
      ws.send(msg);
    }
  }

  function tick() {
    const session = runningCommissions.get(commissionId);
    if (!session || session.status === "aborted") {
      // 中断された場合
      sendNotification("commission.completed", {
        commissionId,
        status: "aborted",
      });
      runningCommissions.delete(commissionId);
      return;
    }

    if (phaseIndex >= phases.length) {
      // 完了
      sendNotification("commission.completed", {
        commissionId,
        status: "success",
        result: {
          changedFiles: ["src/components/Example.tsx", "src/utils/helper.ts", "src/__tests__/example.test.ts"],
          summary: `Commission "${commissionName}" completed successfully. 3 files modified.`,
        },
      });
      session.status = "completed";
      runningCommissions.delete(commissionId);
      return;
    }

    const currentPhase = phases[phaseIndex];
    session.phase = currentPhase.phase;

    // Stroke通知（フェーズ開始時）
    if (msgInPhase === 0 && phaseIndex < strokes.length) {
      // 前のStrokeを完了にする
      if (phaseIndex > 0) {
        sendNotification("commission.stroke", {
          commissionId,
          ...strokes[phaseIndex - 1],
          status: "completed",
        });
      }
      sendNotification("commission.stroke", {
        commissionId,
        ...strokes[phaseIndex],
        status: "running",
      });
    }

    // 進捗通知
    messageIndex++;
    const progress = Math.round((messageIndex / totalMessages) * 100);
    session.progress = progress;

    sendNotification("commission.progress", {
      commissionId,
      phase: currentPhase.phase,
      message: currentPhase.messages[msgInPhase],
      progress,
      timestamp: new Date().toISOString(),
    });

    msgInPhase++;
    if (msgInPhase >= currentPhase.messages.length) {
      phaseIndex++;
      msgInPhase = 0;
    }

    const delay = currentPhase.duration / currentPhase.messages.length;
    setTimeout(tick, delay);
  }

  // 少し遅延してから開始
  setTimeout(tick, 300);
}

// === Chat ハンドラ ===

const activeChatStreams = new Map(); // chatId -> { aborted }

const chatHandlers = {
  "chat.send": (params, ws, wss) => {
    const { chatId, message, context } = params;
    const messageId = crypto.randomUUID();

    // Mark stream as active
    activeChatStreams.set(chatId, { aborted: false });

    // Simulate AI streaming response
    simulateChatStream(chatId, messageId, message, context, ws);

    return { messageId };
  },

  "chat.abort": (params) => {
    const session = activeChatStreams.get(params.chatId);
    if (session) {
      session.aborted = true;
    }
    return { success: true };
  },
};

function simulateChatStream(chatId, messageId, userMessage, context, ws) {
  // Generate a mock response based on the user's message and context
  const activeFile = context?.activeFile;
  let response;
  let codeChanges = null;

  if (userMessage.toLowerCase().includes("refactor") && activeFile) {
    response = `I'll help you refactor the code in \`${activeFile.path}\`.\n\nHere's my suggestion:\n\n\`\`\`${activeFile.language || "typescript"}\n// Refactored version\n${activeFile.content ? activeFile.content.slice(0, 200) + "\n// ... (refactored)" : "// refactored code here"}\n\`\`\`\n\nI've proposed changes to the file. You can review the diff and accept or reject the changes.`;

    if (activeFile.content) {
      codeChanges = [
        {
          changeId: crypto.randomUUID(),
          filePath: activeFile.path,
          original: activeFile.content,
          modified: activeFile.content.replace(
            /\/\/ .*/,
            "// Refactored by AI assistant"
          ),
          status: "pending",
        },
      ];
    }
  } else if (userMessage.toLowerCase().includes("explain") && activeFile) {
    response = `Let me explain the code in \`${activeFile.path}\`.\n\nThis file contains ${activeFile.language || "code"} that appears to be part of the project's ${activeFile.path.includes("component") ? "UI component" : "module"} layer.\n\nKey observations:\n- The file is written in ${activeFile.language || "an unspecified language"}\n- It's located at \`${activeFile.path}\`\n${context?.cursorPosition ? `- Your cursor is at line ${context.cursorPosition.line}, column ${context.cursorPosition.column}` : ""}\n\nWould you like me to dive deeper into any specific part?`;
  } else if (userMessage.toLowerCase().includes("fix") && activeFile) {
    response = `I'll analyze \`${activeFile.path}\` for potential issues.\n\nHere are the improvements I'd suggest:\n\n1. **Type safety** — Ensure all function parameters have explicit types\n2. **Error handling** — Add try-catch blocks for async operations\n3. **Performance** — Consider memoizing expensive computations\n\nWould you like me to apply any of these fixes?`;
  } else {
    response = `I understand you're asking: "${userMessage}"\n\n${activeFile ? `I can see you're working on \`${activeFile.path}\` (${activeFile.language || "unknown language"}).` : "No file is currently active."}\n\n${context?.openFiles?.length ? `You have ${context.openFiles.length} file(s) open: ${context.openFiles.slice(0, 3).map(f => `\`${f}\``).join(", ")}${context.openFiles.length > 3 ? "..." : ""}` : ""}\n\n${context?.gitChangedFiles?.length ? `There are ${context.gitChangedFiles.length} uncommitted change(s).` : ""}\n\nHow can I help you with your code?`;
  }

  // Stream the response token by token (word by word)
  const words = response.split(/(?<=\s)/);
  let wordIndex = 0;

  function sendChunk() {
    const session = activeChatStreams.get(chatId);
    if (!session || session.aborted) {
      // Send final done signal on abort
      const msg = JSON.stringify({
        jsonrpc: "2.0",
        method: "chat.stream",
        params: { chatId, messageId, delta: "", done: true },
      });
      if (ws.readyState === 1) ws.send(msg);
      activeChatStreams.delete(chatId);
      return;
    }

    if (wordIndex >= words.length) {
      // Stream complete — send done with any code changes
      const msg = JSON.stringify({
        jsonrpc: "2.0",
        method: "chat.stream",
        params: {
          chatId,
          messageId,
          delta: "",
          done: true,
          codeChanges: codeChanges ?? undefined,
        },
      });
      if (ws.readyState === 1) ws.send(msg);
      activeChatStreams.delete(chatId);
      return;
    }

    // Send next word(s)
    const batchSize = Math.min(3, words.length - wordIndex);
    let delta = "";
    for (let i = 0; i < batchSize; i++) {
      delta += words[wordIndex + i];
    }
    wordIndex += batchSize;

    const msg = JSON.stringify({
      jsonrpc: "2.0",
      method: "chat.stream",
      params: { chatId, messageId, delta, done: false },
    });
    if (ws.readyState === 1) ws.send(msg);

    // Random delay between 30-80ms per chunk for realistic streaming
    const delay = 30 + Math.random() * 50;
    setTimeout(sendChunk, delay);
  }

  // Start streaming after a small initial delay
  setTimeout(sendChunk, 200);
}

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

    const allHandlers = { ...handlers, ...gitHandlers, ...studioHandlers, ...commissionHandlers, ...chatHandlers, ...terminalHandlers };
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

console.log(`[dev-server] WebSocket server running on ws://localhost:${PORT}`);
