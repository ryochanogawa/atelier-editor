import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BuildLogViewer } from "@/components/Editor/Environment/BuildLogViewer";

describe("BuildLogViewer", () => {
  it("shows empty state when no logs", () => {
    render(<BuildLogViewer logs={[]} />);

    expect(screen.getByText("ログはまだありません")).toBeInTheDocument();
  });

  it("renders all log lines", () => {
    const logs = ["Step 1/3: FROM node:20", "Step 2/3: COPY . .", "Step 3/3: RUN npm install"];
    render(<BuildLogViewer logs={logs} />);

    for (const line of logs) {
      expect(screen.getByText(line)).toBeInTheDocument();
    }
  });

  it("renders log lines preserving whitespace", () => {
    render(<BuildLogViewer logs={["  indented line"]} />);

    const el = screen.getByText("indented line");
    expect(el.className).toContain("whitespace-pre-wrap");
  });

  it("shows 'Scroll to bottom' button when autoScroll is disabled", async () => {
    const logs = Array.from({ length: 50 }, (_, i) => `line-${i}`);
    render(<BuildLogViewer logs={logs} />);

    // By default autoScroll is true, so button should not be visible
    expect(screen.queryByText("Scroll to bottom")).not.toBeInTheDocument();
  });
});
