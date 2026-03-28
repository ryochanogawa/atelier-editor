import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// vi.mock is hoisted, so we must use vi.hoisted for the mock variable
const { MockDiffEditor } = vi.hoisted(() => {
  const MockDiffEditor = vi.fn((props: Record<string, unknown>) => (
    <div data-testid="monaco-diff-editor">
      <span data-testid="original">{String(props.original)}</span>
      <span data-testid="modified">{String(props.modified)}</span>
      <span data-testid="language">{String(props.language)}</span>
      <span data-testid="theme">{String(props.theme)}</span>
    </div>
  ));
  return { MockDiffEditor };
});

vi.mock("next/dynamic", () => ({
  __esModule: true,
  default: () => MockDiffEditor,
}));

import { DiffEditor } from "@/components/Editor/DiffEditor";

describe("DiffEditor", () => {
  it("renders with correct original and modified content", () => {
    render(
      <DiffEditor
        original="const a = 1;"
        modified="const a = 2;"
        language="typescript"
        path="/src/a.ts"
      />
    );

    expect(screen.getByTestId("original")).toHaveTextContent("const a = 1;");
    expect(screen.getByTestId("modified")).toHaveTextContent("const a = 2;");
  });

  it("passes language to MonacoDiffEditor", () => {
    render(
      <DiffEditor
        original=""
        modified=""
        language="javascript"
        path="/src/b.js"
      />
    );

    expect(screen.getByTestId("language")).toHaveTextContent("javascript");
  });

  it("passes theme name to MonacoDiffEditor", () => {
    render(
      <DiffEditor
        original=""
        modified=""
        language="typescript"
        path="/src/c.ts"
      />
    );

    expect(screen.getByTestId("theme")).toHaveTextContent("atelier-dark");
  });

  it("uses path as key for re-mount", () => {
    const { rerender } = render(
      <DiffEditor original="a" modified="b" language="ts" path="/src/a.ts" />
    );

    rerender(
      <DiffEditor original="c" modified="d" language="ts" path="/src/b.ts" />
    );

    expect(screen.getByTestId("original")).toHaveTextContent("c");
    expect(screen.getByTestId("modified")).toHaveTextContent("d");
  });

  it("passes readOnly option", () => {
    render(
      <DiffEditor original="" modified="" language="ts" path="/a.ts" />
    );

    const lastCall = MockDiffEditor.mock.calls[MockDiffEditor.mock.calls.length - 1][0];
    expect(lastCall.options).toMatchObject({
      readOnly: true,
      fontSize: 14,
      minimap: { enabled: false },
      renderSideBySide: true,
    });
  });
});
