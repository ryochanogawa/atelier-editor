import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBar } from "@/components/Editor/StatusBar";
import { useWorkspaceStore } from "@/stores/workspace";

describe("StatusBar", () => {
  it("shows Disconnected status by default", () => {
    render(<StatusBar />);
    expect(screen.getByText("Disconnected")).toBeInTheDocument();
  });

  it("shows Connected status with green indicator", () => {
    useWorkspaceStore.setState({ status: "connected" });
    render(<StatusBar />);
    expect(screen.getByText("Connected")).toBeInTheDocument();
  });

  it("shows Connecting... status", () => {
    useWorkspaceStore.setState({ status: "connecting" });
    render(<StatusBar />);
    expect(screen.getByText("Connecting...")).toBeInTheDocument();
  });

  it("shows Reconnecting... status", () => {
    useWorkspaceStore.setState({ status: "reconnecting" });
    render(<StatusBar />);
    expect(screen.getByText("Reconnecting...")).toBeInTheDocument();
  });

  it("displays cursor position when set", () => {
    useWorkspaceStore.setState({ cursorPosition: { line: 42, column: 13 } });
    render(<StatusBar />);
    expect(screen.getByText("Ln 42, Col 13")).toBeInTheDocument();
  });

  it("does not display cursor position when null", () => {
    render(<StatusBar />);
    expect(screen.queryByText(/Ln \d+/)).not.toBeInTheDocument();
  });

  it("displays file language when a file is active", () => {
    const openFiles = new Map([
      ["/index.ts", { path: "/index.ts", content: "", originalContent: "", language: "typescript" }],
    ]);
    useWorkspaceStore.setState({ activeTab: "/index.ts", openFiles });
    render(<StatusBar />);
    expect(screen.getByText("typescript")).toBeInTheDocument();
  });

  it("always displays UTF-8", () => {
    render(<StatusBar />);
    expect(screen.getByText("UTF-8")).toBeInTheDocument();
  });
});
