import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ResizeHandle } from "@/components/Editor/Terminal/ResizeHandle";

describe("ResizeHandle", () => {
  it("renders a resize handle with ns-resize cursor", () => {
    const onResize = vi.fn();
    const onResizeEnd = vi.fn();

    const { container } = render(
      <ResizeHandle onResize={onResize} onResizeEnd={onResizeEnd} />
    );

    const handle = container.firstElementChild as HTMLElement;
    expect(handle).toBeInTheDocument();
    expect(handle.className).toContain("cursor-ns-resize");
  });

  it("calls onResize with deltaY during mouse drag", () => {
    const onResize = vi.fn();
    const onResizeEnd = vi.fn();

    const { container } = render(
      <ResizeHandle onResize={onResize} onResizeEnd={onResizeEnd} />
    );

    const handle = container.firstElementChild as HTMLElement;

    // Start drag at Y=300
    fireEvent.mouseDown(handle, { clientY: 300 });

    // Move to Y=250 (drag up by 50px → deltaY = 300 - 250 = 50)
    fireEvent.mouseMove(document, { clientY: 250 });
    expect(onResize).toHaveBeenCalledWith(50);

    // Move to Y=270 (drag down by 20px from 250 → deltaY = 250 - 270 = -20)
    fireEvent.mouseMove(document, { clientY: 270 });
    expect(onResize).toHaveBeenCalledWith(-20);
  });

  it("calls onResizeEnd on mouseup", () => {
    const onResize = vi.fn();
    const onResizeEnd = vi.fn();

    const { container } = render(
      <ResizeHandle onResize={onResize} onResizeEnd={onResizeEnd} />
    );

    const handle = container.firstElementChild as HTMLElement;

    fireEvent.mouseDown(handle, { clientY: 300 });
    fireEvent.mouseUp(document);

    expect(onResizeEnd).toHaveBeenCalledOnce();
  });

  it("sets cursor style during drag and resets on mouseup", () => {
    const onResize = vi.fn();
    const onResizeEnd = vi.fn();

    const { container } = render(
      <ResizeHandle onResize={onResize} onResizeEnd={onResizeEnd} />
    );

    const handle = container.firstElementChild as HTMLElement;

    fireEvent.mouseDown(handle, { clientY: 300 });
    expect(document.body.style.cursor).toBe("ns-resize");
    expect(document.body.style.userSelect).toBe("none");

    fireEvent.mouseUp(document);
    expect(document.body.style.cursor).toBe("");
    expect(document.body.style.userSelect).toBe("");
  });

  it("removes event listeners after mouseup", () => {
    const onResize = vi.fn();
    const onResizeEnd = vi.fn();

    const { container } = render(
      <ResizeHandle onResize={onResize} onResizeEnd={onResizeEnd} />
    );

    const handle = container.firstElementChild as HTMLElement;

    fireEvent.mouseDown(handle, { clientY: 300 });
    fireEvent.mouseUp(document);

    onResize.mockClear();
    onResizeEnd.mockClear();

    // Additional mousemove should not trigger onResize
    fireEvent.mouseMove(document, { clientY: 200 });
    expect(onResize).not.toHaveBeenCalled();
  });
});
