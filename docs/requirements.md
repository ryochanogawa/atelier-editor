# ATELIER Editor 要件定義書

## 1. プロダクト概要

**ATELIER Editor** — ブラウザベースの軽量コードエディタ。複数リポジトリ・複数ブランチの同時作業とAIエージェント連携を実現する。

ATELIER CLIをバックエンドとし、WebSocket（JSON-RPC 2.0）で通信する。エディタはフロントエンドに徹し、ファイル操作・Git操作・AI実行はすべてCLI側が担う。

## 2. ターゲットユーザー

- 個人開発者
- 複数タスクを並行して進める開発スタイル

## 3. 解決する課題

- ブランチ切り替えが面倒で、複数タスクの並行作業が非効率
- AIエージェントの実行状況や変更内容の確認が煩雑
- 各ブランチのWebフロントエンドプレビューを並べて確認できない

## 4. コア機能

| #  | 機能                 | 概要                                                          |
|----|----------------------|---------------------------------------------------------------|
| F1 | エディタ             | Monaco Editor。軽量、シンタックスハイライト、検索、ファイルツリー |
| F2 | マルチブランチ       | worktreeベースで2〜3ブランチを同時表示・編集                    |
| F3 | ターミナル           | xterm.js + WebSocket PTY。ATELIER CLIと対話                    |
| F4 | Git操作              | ブランチ切替、コミット、プッシュ、diff表示（最低限）             |
| F5 | プレビュー           | worktreeごとにdev server起動、iframe表示、ドメイン設定管理       |
| F6 | Commission実行       | AIワークフロー実行・進捗リアルタイム表示                        |
| F7 | インラインdiff       | AI変更箇所のAccept/Reject UI                                   |
| F8 | コンテキスト共有     | 開いているファイル・カーソル位置をAIに自動送信                   |
| F9 | AIチャットパネル     | ターミナルとは別の対話専用UI                                    |

## 5. アーキテクチャ

### 5.1 全体構成

```
┌─────────────────────────────────────────────────┐
│  Browser (atelier-editor / Next.js)             │
│  ┌──────────┬──────────┬──────────┬───────────┐ │
│  │  Editor  │ Terminal │ Preview  │ AI Chat   │ │
│  │ (Monaco) │ (xterm)  │ (iframe) │  Panel    │ │
│  └────┬─────┴────┬─────┴────┬─────┴─────┬─────┘ │
│       └──────────┴──────────┴───────────┘       │
│                     │ WebSocket                  │
└─────────────────────┼───────────────────────────┘
                      │
┌─────────────────────┼───────────────────────────┐
│  ATELIER CLI (daemon mode: atelier serve)        │
│                     │                            │
│  ┌─────────────────────────────────────────┐    │
│  │  WebSocket Server (JSON-RPC 2.0)         │    │
│  │  ┌──────────┬──────────┬──────────────┐ │    │
│  │  │ File API │ Git API  │ Commission   │ │    │
│  │  │          │          │ API          │ │    │
│  │  └────┬─────┴────┬─────┴──────┬───────┘ │    │
│  └───────┼──────────┼────────────┼─────────┘    │
│          ↓          ↓            ↓               │
│  ┌─ Application Layer (既存Use Cases) ──────┐   │
│  │  RunCommission │ ManageBranches │ etc.    │   │
│  └──────────────────────────────────────────┘   │
│          ↓          ↓            ↓               │
│  ┌─ Domain Layer (既存) ────────────────────┐   │
│  └──────────────────────────────────────────┘   │
│          ↓          ↓            ↓               │
│  ┌─ Adapters ───────────────────────────────┐   │
│  │ Git(worktree) │ Medium(AI) │ FS │ Logger │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ┌─ Dev Servers (per worktree) ─────────────┐   │
│  │  :3001 (branch-a) │ :3002 (branch-b)     │   │
│  └──────────────────────────────────────────┘   │
└──────────────────────────────────────────────────┘
```

### 5.2 技術スタック

| レイヤー       | 技術                                         |
|----------------|----------------------------------------------|
| フロントエンド | Next.js / React / TypeScript / Tailwind CSS  |
| エディタ       | Monaco Editor                                |
| ターミナル     | xterm.js + xterm-addon-fit                   |
| 通信           | WebSocket (JSON-RPC 2.0)                     |
| バックエンド   | ATELIER CLI (`atelier serve --port 4000`)    |
| ブランチ隔離   | Git worktree（既存CLI機能）                   |
| AI             | Claude Code / Codex / Gemini（既存CLI機能）  |

### 5.3 WebSocketプロトコル

JSON-RPC 2.0ベースの双方向通信。

```typescript
// クライアント → サーバー（リクエスト）
interface Request {
  jsonrpc: "2.0";
  id: string;
  method: string;       // "fs.readFile", "git.commit", etc.
  params: Record<string, unknown>;
}

// サーバー → クライアント（レスポンス）
interface Response {
  jsonrpc: "2.0";
  id: string;
  result?: unknown;
  error?: { code: number; message: string };
}

// サーバー → クライアント（イベント通知）
interface Notification {
  jsonrpc: "2.0";
  method: string;       // "event.stroke:complete", etc.
  params: Record<string, unknown>;
}
```

### 5.4 API名前空間

| 名前空間       | メソッド例                                    | 用途                |
|----------------|-----------------------------------------------|---------------------|
| **fs**         | `readDir`, `readFile`, `writeFile`, `watch`   | ファイル操作        |
| **git**        | `status`, `commit`, `push`, `diff`, `branches`| Git操作             |
| **studio**     | `list`, `create`, `switch`, `remove`          | worktree管理        |
| **commission** | `run`, `abort`, `status`, `list`              | AIワークフロー実行  |
| **medium**     | `chat`, `complete`, `cancel`                  | AI直接対話          |
| **terminal**   | `create`, `input`, `resize`, `kill`           | PTY管理             |
| **preview**    | `start`, `stop`, `list`, `configure`          | dev server管理      |
| **workspace**  | `info`, `setContext`                          | エディタコンテキスト |

## 6. 設計方針

- **1プロセス複数リポジトリ**: `atelier serve` 1プロセスで複数リポジトリを管理（シンプル・リソース効率優先）
- **フロントエンドはpure**: ファイル操作・Git・AI実行はすべてCLI側。Editor側はUI表示とWebSocket通信のみ
- **既存CLI資産を最大活用**: CLI既存のDDD構造、TypedEventEmitter、worktree管理をそのまま利用
- **軽量**: VSCodeライクだが必要最低限の機能に絞る

## 7. 実装フェーズ

| Phase | 内容                                              | 依存    |
|-------|---------------------------------------------------|---------|
| **1** | WebSocket基盤 + ファイル操作 + ファイルツリー実接続 | -       |
| **2** | Git操作UI + worktree管理（マルチブランチ表示）      | Phase 1 |
| **3** | ターミナル（PTY over WebSocket）                    | Phase 1 |
| **4** | Commission実行 + リアルタイム進捗表示               | Phase 3 |
| **5** | プレビュー（dev server管理 + iframe + ドメイン設定） | Phase 2 |
| **6** | AIチャット + インラインdiff + コンテキスト共有       | Phase 4 |

## 8. 非機能要件

- **パフォーマンス**: 大規模ファイルツリーでもスムーズに動作（仮想スクロール等）
- **安定性**: WebSocket切断時の自動再接続
- **セキュリティ**: ローカル環境前提。外部公開は想定しない
