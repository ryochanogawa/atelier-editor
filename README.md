# ATELIER Editor

ブラウザベースの軽量コードエディタ。複数ブランチの同時作業とAIエージェント連携を実現する。

バックエンドに [ATELIER CLI](https://github.com/ryochanogawa/atelier) を使用し、WebSocket（JSON-RPC 2.0）で通信する。

## 主な機能

- **Monaco Editor** によるコード編集
- **マルチブランチ** — Git worktreeベースで複数ブランチを同時表示・編集
- **ターミナル** — xterm.js + WebSocket PTY
- **Git操作** — ブランチ切替、コミット、プッシュ、diff表示
- **プレビュー** — worktreeごとにdev serverを起動しiframeで表示
- **Commission実行** — AIワークフローの実行・進捗リアルタイム表示
- **インラインdiff** — AI変更箇所のAccept/Reject UI
- **AIチャットパネル** — 対話専用UI、開いているファイル・カーソル位置を自動共有

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | Next.js / React / TypeScript / Tailwind CSS |
| エディタ | Monaco Editor |
| ターミナル | xterm.js |
| 状態管理 | Zustand |
| 通信 | WebSocket (JSON-RPC 2.0) |
| バックエンド | ATELIER CLI (`atelier serve --port 4000`) |

## 前提条件

- Node.js >= 20
- [ATELIER CLI](https://github.com/ryochanogawa/atelier) がインストール済みであること

```bash
npm install -g github:ryochanogawa/atelier
```

## セットアップ

```bash
git clone https://github.com/ryochanogawa/atelier-editor.git
cd atelier-editor
npm install
```

## 起動

フロントエンドとバックエンドの両方を起動する必要がある。

```bash
# ターミナル1: バックエンド (WebSocketサーバー, port 4000)
npm run dev:server

# ターミナル2: フロントエンド (Next.js, port 3000)
npm run dev
```

ブラウザで http://localhost:3000 を開く。

## スクリプト一覧

| コマンド | 説明 |
|---|---|
| `npm run dev` | Next.js開発サーバー起動 |
| `npm run dev:server` | WebSocketバックエンドサーバー起動 |
| `npm run build` | プロダクションビルド |
| `npm start` | プロダクションサーバー起動 |
| `npm test` | テスト実行 |

## アーキテクチャ

```
Browser (Next.js)                ATELIER CLI (daemon)
┌──────────────────┐            ┌──────────────────────┐
│ Editor (Monaco)  │            │ WebSocket Server     │
│ Terminal (xterm) │◄──WS────►│ File / Git / AI API  │
│ Preview (iframe) │            │                      │
│ AI Chat Panel    │            │ Dev Servers          │
└──────────────────┘            │  :3001, :3002 ...    │
                                └──────────────────────┘
```

## ライセンス

ISC
