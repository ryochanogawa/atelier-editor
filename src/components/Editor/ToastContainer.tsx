"use client";

import { useWorkspaceStore } from "@/stores/workspace";

const TYPE_STYLES = {
  info: "bg-[#007acc]",
  success: "bg-[#4caf50]",
  error: "bg-[#c74e39]",
} as const;

export function ToastContainer() {
  const toasts = useWorkspaceStore((s) => s.toasts);
  const removeToast = useWorkspaceStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-10 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-2 rounded px-3 py-2 text-[13px] text-white shadow-lg ${TYPE_STYLES[toast.type]}`}
        >
          <span className="flex-1">{toast.message}</span>
          <button
            type="button"
            className="shrink-0 text-white/80 hover:text-white"
            onClick={() => removeToast(toast.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
