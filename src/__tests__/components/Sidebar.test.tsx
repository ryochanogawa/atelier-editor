import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sidebar } from "@/components/Editor/Sidebar";
import { useWorkspaceStore } from "@/stores/workspace";

// Mock child components to isolate Sidebar logic
vi.mock("@/components/Editor/FileExplorer", () => ({
  FileExplorer: () => <div data-testid="file-explorer">FileExplorer</div>,
}));

vi.mock("@/components/Editor/Git/GitPanel", () => ({
  GitPanel: () => <div data-testid="git-panel">GitPanel</div>,
}));

vi.mock("@/components/Editor/Commission/CommissionPanel", () => ({
  CommissionPanel: () => <div data-testid="commission-panel">CommissionPanel</div>,
}));

vi.mock("@/components/Editor/Chat/ChatPanel", () => ({
  ChatPanel: () => <div data-testid="chat-panel">ChatPanel</div>,
}));

describe("Sidebar", () => {
  it("renders activity bar with Explorer, Source Control, Commission, and AI Chat buttons", () => {
    render(<Sidebar />);

    expect(screen.getByTitle("Explorer")).toBeInTheDocument();
    expect(screen.getByTitle("Source Control")).toBeInTheDocument();
    expect(screen.getByTitle("Commission")).toBeInTheDocument();
    expect(screen.getByTitle("AI Chat")).toBeInTheDocument();
  });

  it("shows FileExplorer by default (files view)", () => {
    render(<Sidebar />);

    expect(screen.getByTestId("file-explorer")).toBeInTheDocument();
    expect(screen.queryByTestId("git-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("commission-panel")).not.toBeInTheDocument();
  });

  it("switches to GitPanel when Source Control clicked", async () => {
    const user = userEvent.setup();
    render(<Sidebar />);

    await user.click(screen.getByTitle("Source Control"));

    expect(screen.getByTestId("git-panel")).toBeInTheDocument();
    expect(screen.queryByTestId("file-explorer")).not.toBeInTheDocument();
  });

  it("switches back to FileExplorer when Explorer clicked", async () => {
    const user = userEvent.setup();
    useWorkspaceStore.setState({ sidebarView: "git" });
    render(<Sidebar />);

    expect(screen.getByTestId("git-panel")).toBeInTheDocument();

    await user.click(screen.getByTitle("Explorer"));

    expect(screen.getByTestId("file-explorer")).toBeInTheDocument();
    expect(screen.queryByTestId("git-panel")).not.toBeInTheDocument();
  });

  it("updates store sidebarView on click", async () => {
    const user = userEvent.setup();
    render(<Sidebar />);

    await user.click(screen.getByTitle("Source Control"));
    expect(useWorkspaceStore.getState().sidebarView).toBe("git");

    await user.click(screen.getByTitle("Explorer"));
    expect(useWorkspaceStore.getState().sidebarView).toBe("files");
  });

  it("switches to CommissionPanel when Commission clicked", async () => {
    const user = userEvent.setup();
    render(<Sidebar />);

    await user.click(screen.getByTitle("Commission"));

    expect(screen.getByTestId("commission-panel")).toBeInTheDocument();
    expect(screen.queryByTestId("file-explorer")).not.toBeInTheDocument();
    expect(screen.queryByTestId("git-panel")).not.toBeInTheDocument();
  });

  it("switches from Commission back to Explorer", async () => {
    const user = userEvent.setup();
    useWorkspaceStore.setState({ sidebarView: "commission" });
    render(<Sidebar />);

    expect(screen.getByTestId("commission-panel")).toBeInTheDocument();

    await user.click(screen.getByTitle("Explorer"));

    expect(screen.getByTestId("file-explorer")).toBeInTheDocument();
    expect(screen.queryByTestId("commission-panel")).not.toBeInTheDocument();
  });

  it("sets sidebarView to commission on Commission click", async () => {
    const user = userEvent.setup();
    render(<Sidebar />);

    await user.click(screen.getByTitle("Commission"));
    expect(useWorkspaceStore.getState().sidebarView).toBe("commission");
  });

  // Phase 6: AI Chat view
  it("switches to ChatPanel when AI Chat clicked", async () => {
    const user = userEvent.setup();
    render(<Sidebar />);

    await user.click(screen.getByTitle("AI Chat"));

    expect(screen.getByTestId("chat-panel")).toBeInTheDocument();
    expect(screen.queryByTestId("file-explorer")).not.toBeInTheDocument();
    expect(screen.queryByTestId("git-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("commission-panel")).not.toBeInTheDocument();
  });

  it("sets sidebarView to chat on AI Chat click", async () => {
    const user = userEvent.setup();
    render(<Sidebar />);

    await user.click(screen.getByTitle("AI Chat"));
    expect(useWorkspaceStore.getState().sidebarView).toBe("chat");
  });

  it("switches from Chat back to Explorer", async () => {
    const user = userEvent.setup();
    useWorkspaceStore.setState({ sidebarView: "chat" });
    render(<Sidebar />);

    expect(screen.getByTestId("chat-panel")).toBeInTheDocument();

    await user.click(screen.getByTitle("Explorer"));

    expect(screen.getByTestId("file-explorer")).toBeInTheDocument();
    expect(screen.queryByTestId("chat-panel")).not.toBeInTheDocument();
  });
});
