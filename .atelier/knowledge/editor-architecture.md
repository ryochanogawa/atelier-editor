# ATELIER Editor アーキテクチャ

## 技術スタック
- Next.js 16 (App Router)
- React 19
- Monaco Editor (@monaco-editor/react)
- Zustand v5 (状態管理)
- Tailwind CSS 4
- WebSocket (JSON-RPC 2.0)

## ディレクトリ構成
src/
├── app/           — Next.js App Router (layout.tsx, page.tsx, globals.css)
├── components/    — UIコンポーネント
│   └── Editor/    — CodeEditor, EditorLayout, FileExplorer, TabBar, StatusBar
├── hooks/         — useConnection, useKeyboardShortcuts
├── stores/        — Zustand ストア (workspace.ts)
└── lib/
    ├── rpc/       — JSON-RPC 2.0 クライアント (client.ts, types.ts)
    └── editor/    — Monaco Editor 設定 (theme.ts)
scripts/
└── dev-server.mjs — 開発用 WebSocket サーバー

## 通信プロトコル
JSON-RPC 2.0 over WebSocket
- workspace.info — ワークスペース情報取得
- fs.readTree — ファイルツリー取得
- fs.readFile — ファイル内容読み込み
- fs.writeFile — ファイル書き込み
- fs.watch — ファイル変更通知（サーバー→クライアント）

## 状態管理 (Zustand)
workspace store が接続状態、ファイルツリー、ファイル内容、タブ、カーソル位置を一元管理

## コンポーネント責務
| コンポーネント | 責務 |
|------------|------|
| EditorLayout | メインレイアウト（サイドバー + エディタ領域） |
| FileExplorer | ファイルツリー表示、ディレクトリ展開/折りたたみ |
| TabBar | 開いているファイルのタブ管理、変更インジケータ |
| CodeEditor | Monaco Editor ラッパー、カーソル追跡 |
| StatusBar | 接続状態、カーソル位置、言語、エンコーディング表示 |
