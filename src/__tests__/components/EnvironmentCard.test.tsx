import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EnvironmentCard } from "@/components/Editor/Environment/EnvironmentCard";
import type { EnvironmentState } from "@/lib/environment/types";

// Mock child components
vi.mock("@/components/Editor/Environment/EnvironmentActions", () => ({
  EnvironmentActions: ({ worktreeId, status }: { worktreeId: string; status: string }) => (
    <div data-testid="env-actions" data-worktree={worktreeId} data-status={status} />
  ),
}));

vi.mock("@/components/Editor/Environment/EnvironmentError", () => ({
  EnvironmentError: ({ error }: { error: string }) => (
    <div data-testid="env-error">{error}</div>
  ),
}));

const baseEnv: EnvironmentState = {
  worktreeId: "wt-1",
  branch: "main",
  status: "idle",
  config: null,
  hostPort: null,
  containerId: null,
  error: null,
  setupCompleted: false,
  serviceStates: {},
};

describe("EnvironmentCard", () => {
  it("displays branch name", () => {
    render(<EnvironmentCard env={baseEnv} onViewLogs={vi.fn()} />);

    expect(screen.getByText("main")).toBeInTheDocument();
  });

  it("displays status label", () => {
    render(<EnvironmentCard env={{ ...baseEnv, status: "running" }} onViewLogs={vi.fn()} />);

    expect(screen.getByText("Running")).toBeInTheDocument();
  });

  it("displays host port when available", () => {
    render(
      <EnvironmentCard env={{ ...baseEnv, hostPort: 3001 }} onViewLogs={vi.fn()} />
    );

    expect(screen.getByText(":3001")).toBeInTheDocument();
  });

  it("does not display host port when null", () => {
    render(<EnvironmentCard env={baseEnv} onViewLogs={vi.fn()} />);

    expect(screen.queryByText(/:3\d+/)).not.toBeInTheDocument();
  });

  it("displays config info when config is present", () => {
    const env: EnvironmentState = {
      ...baseEnv,
      config: {
        version: "1",
        base: "node:20-slim",
        dev: { command: "npm run dev", port: 3000 },
      },
    };
    render(<EnvironmentCard env={env} onViewLogs={vi.fn()} />);

    expect(screen.getByText("node:20-slim")).toBeInTheDocument();
    expect(screen.getByText("npm run dev")).toBeInTheDocument();
  });

  it("displays compose field when present in config", () => {
    const env: EnvironmentState = {
      ...baseEnv,
      config: {
        version: "1",
        base: "node:20-slim",
        compose: "docker-compose.yml",
        dev: { command: "npm run dev", port: 3000 },
      },
    };
    render(<EnvironmentCard env={env} onViewLogs={vi.fn()} />);

    expect(screen.getByText("docker-compose.yml")).toBeInTheDocument();
  });

  it("does not show config section when config is null", () => {
    render(<EnvironmentCard env={baseEnv} onViewLogs={vi.fn()} />);

    expect(screen.queryByText("base:")).not.toBeInTheDocument();
  });

  it("renders service states", () => {
    const env: EnvironmentState = {
      ...baseEnv,
      serviceStates: {
        db: { name: "db", containerId: "abc", status: "running", hostPort: 5432 },
        redis: { name: "redis", containerId: "def", status: "stopped", hostPort: null },
      },
    };
    render(<EnvironmentCard env={env} onViewLogs={vi.fn()} />);

    expect(screen.getByText("db")).toBeInTheDocument();
    expect(screen.getByText(":5432")).toBeInTheDocument();
    expect(screen.getByText("redis")).toBeInTheDocument();
  });

  it("shows EnvironmentError when status is error and error exists", () => {
    const env: EnvironmentState = {
      ...baseEnv,
      status: "error",
      error: "Docker daemon not running",
    };
    render(<EnvironmentCard env={env} onViewLogs={vi.fn()} />);

    expect(screen.getByTestId("env-error")).toBeInTheDocument();
    expect(screen.getByText("Docker daemon not running")).toBeInTheDocument();
  });

  it("does not show error when status is not error", () => {
    const env: EnvironmentState = {
      ...baseEnv,
      status: "running",
      error: "some old error",
    };
    render(<EnvironmentCard env={env} onViewLogs={vi.fn()} />);

    expect(screen.queryByTestId("env-error")).not.toBeInTheDocument();
  });

  it("calls onViewLogs with worktreeId when Logs button clicked", async () => {
    const user = userEvent.setup();
    const onViewLogs = vi.fn();
    render(<EnvironmentCard env={baseEnv} onViewLogs={onViewLogs} />);

    await user.click(screen.getByText("Logs"));

    expect(onViewLogs).toHaveBeenCalledWith("wt-1");
  });

  it("passes correct props to EnvironmentActions", () => {
    render(
      <EnvironmentCard env={{ ...baseEnv, status: "running" }} onViewLogs={vi.fn()} />
    );

    const actions = screen.getByTestId("env-actions");
    expect(actions).toHaveAttribute("data-worktree", "wt-1");
    expect(actions).toHaveAttribute("data-status", "running");
  });
});
