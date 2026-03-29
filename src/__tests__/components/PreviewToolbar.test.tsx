import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PreviewToolbar } from "@/components/Editor/Preview/PreviewToolbar";
import { useWorkspaceStore } from "@/stores/workspace";

// --- Mock RPC client ---
const mockCall = vi.fn();

vi.mock("@/lib/rpc/client", () => ({
  getRpcClient: () => ({
    call: mockCall,
  }),
}));

describe("PreviewToolbar", () => {
  beforeEach(() => {
    mockCall.mockReset();
    mockCall.mockResolvedValue({});
  });

  // ── Start/Stop button ──

  describe("Start/Stop button", () => {
    it("shows Start button when stopped", () => {
      render(<PreviewToolbar />);
      expect(screen.getByTitle("Start dev server")).toBeInTheDocument();
      expect(screen.getByText("Start")).toBeInTheDocument();
    });

    it("shows Stop button when running", () => {
      useWorkspaceStore.setState({ devServerStatus: "running" });
      render(<PreviewToolbar />);
      expect(screen.getByTitle("Stop dev server")).toBeInTheDocument();
      expect(screen.getByText("Stop")).toBeInTheDocument();
    });

    it("shows Starting... when starting and button is disabled", () => {
      useWorkspaceStore.setState({ devServerStatus: "starting" });
      render(<PreviewToolbar />);
      expect(screen.getByText("Starting...")).toBeInTheDocument();
      expect(screen.getByText("Starting...").closest("button")).toBeDisabled();
    });

    it("calls preview.start on Start click", async () => {
      const user = userEvent.setup();
      render(<PreviewToolbar />);

      await user.click(screen.getByTitle("Start dev server"));
      expect(mockCall).toHaveBeenCalledWith("preview.start", {});
    });

    it("calls preview.stop on Stop click", async () => {
      const user = userEvent.setup();
      useWorkspaceStore.setState({ devServerStatus: "running" });
      render(<PreviewToolbar />);

      await user.click(screen.getByTitle("Stop dev server"));
      expect(mockCall).toHaveBeenCalledWith("preview.stop", {});
    });

    it("shows toast on RPC error", async () => {
      const user = userEvent.setup();
      mockCall.mockRejectedValue(new Error("Connection lost"));
      render(<PreviewToolbar />);

      await user.click(screen.getByTitle("Start dev server"));

      const toasts = useWorkspaceStore.getState().toasts;
      expect(toasts).toHaveLength(1);
      expect(toasts[0].message).toContain("Connection lost");
      expect(toasts[0].type).toBe("error");
    });
  });

  // ── Reload button ──

  describe("Reload button", () => {
    it("is disabled when server is not running", () => {
      render(<PreviewToolbar />);
      expect(screen.getByTitle("Reload preview")).toBeDisabled();
    });

    it("is enabled when server is running", () => {
      useWorkspaceStore.setState({ devServerStatus: "running" });
      render(<PreviewToolbar />);
      expect(screen.getByTitle("Reload preview")).not.toBeDisabled();
    });
  });

  // ── Viewport presets ──

  describe("viewport presets", () => {
    it("renders Auto and all preset buttons", () => {
      render(<PreviewToolbar />);
      expect(screen.getByText("Auto")).toBeInTheDocument();
      expect(screen.getByText("Mobile")).toBeInTheDocument();
      expect(screen.getByText("Tablet")).toBeInTheDocument();
      expect(screen.getByText("Desktop")).toBeInTheDocument();
    });

    it("clicking Mobile sets activeViewport to Mobile preset", async () => {
      const user = userEvent.setup();
      render(<PreviewToolbar />);

      await user.click(screen.getByText("Mobile"));
      const vp = useWorkspaceStore.getState().activeViewport;
      expect(vp).toEqual({ name: "Mobile", width: 375, height: 667 });
    });

    it("clicking Auto clears activeViewport", async () => {
      const user = userEvent.setup();
      useWorkspaceStore.setState({
        activeViewport: { name: "Mobile", width: 375, height: 667 },
      });
      render(<PreviewToolbar />);

      await user.click(screen.getByText("Auto"));
      expect(useWorkspaceStore.getState().activeViewport).toBeNull();
    });

    it("shows viewport dimensions in title", () => {
      render(<PreviewToolbar />);
      expect(screen.getByTitle("Mobile (375x667)")).toBeInTheDocument();
      expect(screen.getByTitle("Tablet (768x1024)")).toBeInTheDocument();
      expect(screen.getByTitle("Desktop (1440x900)")).toBeInTheDocument();
    });
  });

  // ── Server status indicator ──

  describe("status indicator", () => {
    it("shows current status text", () => {
      useWorkspaceStore.setState({ devServerStatus: "running" });
      render(<PreviewToolbar />);
      expect(screen.getByText("running")).toBeInTheDocument();
    });

    it("shows green indicator when running", () => {
      useWorkspaceStore.setState({ devServerStatus: "running" });
      const { container } = render(<PreviewToolbar />);
      expect(container.querySelector(".bg-green-500")).toBeInTheDocument();
    });

    it("shows yellow indicator when starting", () => {
      useWorkspaceStore.setState({ devServerStatus: "starting" });
      const { container } = render(<PreviewToolbar />);
      expect(container.querySelector(".bg-yellow-500")).toBeInTheDocument();
    });

    it("shows red indicator when error", () => {
      useWorkspaceStore.setState({ devServerStatus: "error" });
      const { container } = render(<PreviewToolbar />);
      expect(container.querySelector(".bg-red-500")).toBeInTheDocument();
    });
  });

  // ── Close button ──

  describe("close button", () => {
    it("hides preview panel on click", async () => {
      const user = userEvent.setup();
      useWorkspaceStore.setState({ previewVisible: true });
      render(<PreviewToolbar />);

      await user.click(screen.getByTitle("Close preview panel"));
      expect(useWorkspaceStore.getState().previewVisible).toBe(false);
    });
  });
});
