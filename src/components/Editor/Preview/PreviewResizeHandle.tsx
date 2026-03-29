"use client";

import { useCallback, useRef } from "react";

interface PreviewResizeHandleProps {
  onResize: (deltaX: number) => void;
  onResizeEnd: () => void;
}

export function PreviewResizeHandle({ onResize, onResizeEnd }: PreviewResizeHandleProps) {
  const startXRef = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      startXRef.current = e.clientX;

      document.body.style.cursor = "ew-resize";
      document.body.style.userSelect = "none";

      const handleMouseMove = (ev: MouseEvent) => {
        const deltaX = startXRef.current - ev.clientX;
        startXRef.current = ev.clientX;
        onResize(deltaX);
      };

      const handleMouseUp = () => {
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        onResizeEnd();
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [onResize, onResizeEnd]
  );

  return (
    <div
      className="group relative z-10 w-1 shrink-0 cursor-ew-resize"
      onMouseDown={handleMouseDown}
    >
      <div className="absolute inset-y-0 -left-0.5 right-0 group-hover:bg-[#007acc] group-active:bg-[#007acc]" />
    </div>
  );
}
