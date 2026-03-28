import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GitStatusList } from "@/components/Editor/Git/GitStatusList";
import type { GitStatusEntry } from "@/lib/rpc/types";

// Mock GitStatusItem to isolate list logic
vi.mock("@/components/Editor/Git/GitStatusItem", () => ({
  GitStatusItem: ({ entry }: { entry: GitStatusEntry }) => (
    <li data-testid={`status-item-${entry.path}`}>
      {entry.path} ({entry.staged ? "staged" : "unstaged"})
    </li>
  ),
}));

describe("GitStatusList", () => {
  it("shows 'No changes detected' when entries is empty", () => {
    render(<GitStatusList entries={[]} />);
    expect(screen.getByText("No changes detected")).toBeInTheDocument();
  });

  it("renders Staged Changes section for staged entries", () => {
    const entries: GitStatusEntry[] = [
      { path: "src/a.ts", status: "modified", staged: true },
    ];
    render(<GitStatusList entries={entries} />);

    expect(screen.getByText("Staged Changes")).toBeInTheDocument();
    expect(screen.queryByText("Changes")).not.toBeInTheDocument();
  });

  it("renders Changes section for unstaged entries", () => {
    const entries: GitStatusEntry[] = [
      { path: "src/b.ts", status: "added", staged: false },
    ];
    render(<GitStatusList entries={entries} />);

    expect(screen.getByText("Changes")).toBeInTheDocument();
    expect(screen.queryByText("Staged Changes")).not.toBeInTheDocument();
  });

  it("renders both sections when mixed staged and unstaged", () => {
    const entries: GitStatusEntry[] = [
      { path: "src/a.ts", status: "modified", staged: true },
      { path: "src/b.ts", status: "added", staged: false },
      { path: "src/c.ts", status: "deleted", staged: true },
    ];
    render(<GitStatusList entries={entries} />);

    expect(screen.getByText("Staged Changes")).toBeInTheDocument();
    expect(screen.getByText("Changes")).toBeInTheDocument();
  });

  it("shows correct counts for each section", () => {
    const entries: GitStatusEntry[] = [
      { path: "a.ts", status: "modified", staged: true },
      { path: "b.ts", status: "added", staged: true },
      { path: "c.ts", status: "deleted", staged: false },
    ];
    render(<GitStatusList entries={entries} />);

    // staged count = 2, unstaged count = 1
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("renders a GitStatusItem for each entry", () => {
    const entries: GitStatusEntry[] = [
      { path: "src/a.ts", status: "modified", staged: true },
      { path: "src/b.ts", status: "added", staged: false },
    ];
    render(<GitStatusList entries={entries} />);

    expect(screen.getByTestId("status-item-src/a.ts")).toBeInTheDocument();
    expect(screen.getByTestId("status-item-src/b.ts")).toBeInTheDocument();
  });
});
