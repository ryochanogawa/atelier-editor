"use client";

import { useCallback, useRef } from "react";

interface ResizeHandleProps {
  onResize: (deltaY: number) => void;
  onResizeEnd: () => void;
}

export function ResizeHandle({ onResize, onResizeEnd }: ResizeHandleProps) {
  const startYRef = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      startYRef.current = e.clientY;

      document.body.style.cursor = "ns-resize";
      document.body.style.userSelect = "none";

      const handleMouseMove = (ev: MouseEvent) => {
        const deltaY = startYRef.current - ev.clientY;
        startYRef.current = ev.clientY;
        onResize(deltaY);
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
      className="group relative z-10 h-1 shrink-0 cursor-ns-resize"
      onMouseDown={handleMouseDown}
    >
      <div className="absolute inset-x-0 -top-0.5 bottom-0 group-hover:bg-[#007acc] group-active:bg-[#007acc]" />
    </div>
  );
}
