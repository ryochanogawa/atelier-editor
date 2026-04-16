"use client";

interface EnvironmentErrorProps {
  error: string;
}

const ERROR_HINTS: Record<string, string> = {
  "port already allocated": "別のプロセスが同じポートを使用しています。docker ps で確認し、不要なコンテナを停止してください。",
  "image not found": "指定されたDockerイメージが見つかりません。イメージ名を確認するか、docker pull を実行してください。",
  "daemon not running": "Docker Desktop が起動していません。Docker Desktop を起動してから再試行してください。",
  "Cannot connect to the Docker daemon": "Docker Desktop が起動していません。Docker Desktop を起動してから再試行してください。",
  "no such file or directory": "指定されたファイルが見つかりません。パスを確認してください。",
  "permission denied": "権限エラーです。Docker グループへの追加やファイル権限を確認してください。",
  "Setup failed": "セットアップコマンドが失敗しました。environment.yml の setup セクションを確認してください。",
};

function getHint(error: string): string | null {
  for (const [pattern, hint] of Object.entries(ERROR_HINTS)) {
    if (error.toLowerCase().includes(pattern.toLowerCase())) {
      return hint;
    }
  }
  return null;
}

export function EnvironmentError({ error }: EnvironmentErrorProps) {
  const hint = getHint(error);

  return (
    <div className="rounded border border-red-800/50 bg-red-950/30 p-3">
      <div className="flex items-start gap-2">
        <svg viewBox="0 0 16 16" className="mt-0.5 h-4 w-4 shrink-0 fill-red-400">
          <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 2a1 1 0 011 1v4a1 1 0 01-2 0V4a1 1 0 011-1zm0 8a1 1 0 100-2 1 1 0 000 2z" />
        </svg>
        <div className="min-w-0 flex-1">
          <p className="break-words text-xs text-red-300">{error}</p>
          {hint && (
            <p className="mt-1.5 text-xs text-[#999]">{hint}</p>
          )}
        </div>
      </div>
    </div>
  );
}
