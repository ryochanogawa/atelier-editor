import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CommitLog } from "@/components/Editor/Git/CommitLog";
import type { GitLogEntry } from "@/lib/rpc/types";

describe("CommitLog", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when entries is empty", () => {
    const { container } = render(<CommitLog entries={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders Commits heading", () => {
    const entries: GitLogEntry[] = [
      { hash: "abc1234567890", message: "init", author: "dev", date: "2026-03-28T10:00:00Z" },
    ];
    render(<CommitLog entries={entries} />);
    expect(screen.getByText("Commits")).toBeInTheDocument();
  });

  it("renders commit hash (first 7 chars)", () => {
    const entries: GitLogEntry[] = [
      { hash: "abc1234567890", message: "init", author: "dev", date: "2026-03-28T10:00:00Z" },
    ];
    render(<CommitLog entries={entries} />);
    expect(screen.getByText("abc1234")).toBeInTheDocument();
  });

  it("renders commit message", () => {
    const entries: GitLogEntry[] = [
      { hash: "abc1234567890", message: "fix: resolve bug", author: "dev", date: "2026-03-28T10:00:00Z" },
    ];
    render(<CommitLog entries={entries} />);
    expect(screen.getByText("fix: resolve bug")).toBeInTheDocument();
  });

  it("renders author name", () => {
    const entries: GitLogEntry[] = [
      { hash: "abc1234567890", message: "init", author: "Alice", date: "2026-03-28T10:00:00Z" },
    ];
    render(<CommitLog entries={entries} />);
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
  });

  it("renders relative date as 'just now' for recent commits", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-28T10:00:30Z"));

    const entries: GitLogEntry[] = [
      { hash: "abc1234567890", message: "init", author: "dev", date: "2026-03-28T10:00:00Z" },
    ];
    render(<CommitLog entries={entries} />);
    expect(screen.getByText(/just now/)).toBeInTheDocument();
  });

  it("renders relative date in minutes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-28T10:05:00Z"));

    const entries: GitLogEntry[] = [
      { hash: "abc1234567890", message: "init", author: "dev", date: "2026-03-28T10:00:00Z" },
    ];
    render(<CommitLog entries={entries} />);
    expect(screen.getByText(/5m ago/)).toBeInTheDocument();
  });

  it("renders relative date in hours", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-28T13:00:00Z"));

    const entries: GitLogEntry[] = [
      { hash: "abc1234567890", message: "init", author: "dev", date: "2026-03-28T10:00:00Z" },
    ];
    render(<CommitLog entries={entries} />);
    expect(screen.getByText(/3h ago/)).toBeInTheDocument();
  });

  it("renders relative date in days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-30T10:00:00Z"));

    const entries: GitLogEntry[] = [
      { hash: "abc1234567890", message: "init", author: "dev", date: "2026-03-28T10:00:00Z" },
    ];
    render(<CommitLog entries={entries} />);
    expect(screen.getByText(/2d ago/)).toBeInTheDocument();
  });

  it("renders multiple commits in order", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-28T12:00:00Z"));

    const entries: GitLogEntry[] = [
      { hash: "aaa1234567890", message: "first", author: "dev", date: "2026-03-28T11:00:00Z" },
      { hash: "bbb1234567890", message: "second", author: "dev", date: "2026-03-28T10:00:00Z" },
    ];
    render(<CommitLog entries={entries} />);

    expect(screen.getByText("first")).toBeInTheDocument();
    expect(screen.getByText("second")).toBeInTheDocument();
    expect(screen.getByText("aaa1234")).toBeInTheDocument();
    expect(screen.getByText("bbb1234")).toBeInTheDocument();
  });
});
