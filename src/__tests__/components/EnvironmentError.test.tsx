import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EnvironmentError } from "@/components/Editor/Environment/EnvironmentError";

describe("EnvironmentError", () => {
  it("displays the error message", () => {
    render(<EnvironmentError error="Something went wrong" />);

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("shows hint for 'port already allocated' error", () => {
    render(<EnvironmentError error="Error: port already allocated" />);

    expect(screen.getByText(/別のプロセスが同じポートを使用/)).toBeInTheDocument();
  });

  it("shows hint for 'image not found' error", () => {
    render(<EnvironmentError error="image not found: myapp:latest" />);

    expect(screen.getByText(/Dockerイメージが見つかりません/)).toBeInTheDocument();
  });

  it("shows hint for 'daemon not running' error", () => {
    render(<EnvironmentError error="Cannot connect to the Docker daemon" />);

    expect(screen.getByText(/Docker Desktop が起動していません/)).toBeInTheDocument();
  });

  it("shows hint for 'no such file or directory' error", () => {
    render(<EnvironmentError error="no such file or directory: /app/config.yml" />);

    expect(screen.getByText(/ファイルが見つかりません/)).toBeInTheDocument();
  });

  it("shows hint for 'permission denied' error", () => {
    render(<EnvironmentError error="permission denied while trying to connect" />);

    expect(screen.getByText(/権限エラー/)).toBeInTheDocument();
  });

  it("shows hint for 'Setup failed' error", () => {
    render(<EnvironmentError error="Setup failed: exit code 1" />);

    expect(screen.getByText(/セットアップコマンドが失敗/)).toBeInTheDocument();
  });

  it("does not show hint for unknown error patterns", () => {
    const { container } = render(<EnvironmentError error="Unknown error xyz" />);

    expect(screen.getByText("Unknown error xyz")).toBeInTheDocument();
    // Only the error message paragraph, no hint paragraph
    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs).toHaveLength(1);
  });

  it("matches error patterns case-insensitively", () => {
    render(<EnvironmentError error="PORT ALREADY ALLOCATED on 8080" />);

    expect(screen.getByText(/別のプロセスが同じポートを使用/)).toBeInTheDocument();
  });
});
