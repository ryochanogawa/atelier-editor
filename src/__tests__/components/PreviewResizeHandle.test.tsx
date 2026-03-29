import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { PreviewResizeHandle } from "@/components/Editor/Preview/PreviewResizeHandle";

describe("PreviewResizeHandle", () => {
  it("renders a resize handle element", () => {
    const { container } = render(
      <PreviewResizeHandle onResize={vi.fn()} onResizeEnd={vi.fn()} />
    );
    const handle = container.firstElementChild;
    expect(handle).toBeInTheDocument();
    expect(handle).toHaveClass("cursor-ew-resize");
  });

  it("calls onResize with deltaX during drag", () => {
    const onResize = vi.fn();
    const onResizeEnd = vi.fn();
    const { container } = render(
      <PreviewResizeHandle onResize={onResize} onResizeEnd={onResizeEnd} />
    );
    const handle = container.firstElementChild!;

    // Start drag at x=500
    fireEvent.mouseDown(handle, { clientX: 500 });

    // Move to x=480 (delta = 500 - 480 = 20, dragging left increases width)
    fireEvent.mouseMove(document, { clientX: 480 });
    expect(onResize).toHaveBeenCalledWith(20);

    // Move again from 480 to 470 (delta = 480 - 470 = 10)
    fireEvent.mouseMove(document, { clientX: 470 });
    expect(onResize).toHaveBeenCalledWith(10);
  });

  it("calls onResizeEnd on mouseup", () => {
    const onResize = vi.fn();
    const onResizeEnd = vi.fn();
    const { container } = render(
      <PreviewResizeHandle onResize={onResize} onResizeEnd={onResizeEnd} />
    );
    const handle = container.firstElementChild!;

    fireEvent.mouseDown(handle, { clientX: 500 });
    fireEvent.mouseUp(document);
    expect(onResizeEnd).toHaveBeenCalledOnce();
  });

  it("sets ew-resize cursor on body during drag", () => {
    const { container } = render(
      <PreviewResizeHandle onResize={vi.fn()} onResizeEnd={vi.fn()} />
    );
    const handle = container.firstElementChild!;

    fireEvent.mouseDown(handle, { clientX: 500 });
    expect(document.body.style.cursor).toBe("ew-resize");

    fireEvent.mouseUp(document);
    expect(document.body.style.cursor).toBe("");
  });

  it("removes event listeners after mouseup", () => {
    const onResize = vi.fn();
    const { container } = render(
      <PreviewResizeHandle onResize={onResize} onResizeEnd={vi.fn()} />
    );
    const handle = container.firstElementChild!;

    fireEvent.mouseDown(handle, { clientX: 500 });
    fireEvent.mouseUp(document);

    // Additional mousemove should not trigger onResize
    onResize.mockClear();
    fireEvent.mouseMove(document, { clientX: 450 });
    expect(onResize).not.toHaveBeenCalled();
  });
});
