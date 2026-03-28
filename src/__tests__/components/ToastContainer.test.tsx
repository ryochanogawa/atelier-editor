import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastContainer } from "@/components/Editor/ToastContainer";
import { useWorkspaceStore } from "@/stores/workspace";

describe("ToastContainer", () => {
  it("renders nothing when no toasts", () => {
    const { container } = render(<ToastContainer />);
    expect(container.firstChild).toBeNull();
  });

  it("renders toast messages", () => {
    useWorkspaceStore.setState({
      toasts: [
        { id: "1", message: "Hello toast", type: "info" },
        { id: "2", message: "Error toast", type: "error" },
      ],
    });
    render(<ToastContainer />);

    expect(screen.getByText("Hello toast")).toBeInTheDocument();
    expect(screen.getByText("Error toast")).toBeInTheDocument();
  });

  it("removes toast when close button clicked", async () => {
    const user = userEvent.setup();
    vi.spyOn(crypto, "randomUUID").mockReturnValue("toast-1" as `${string}-${string}-${string}-${string}-${string}`);

    useWorkspaceStore.setState({
      toasts: [{ id: "toast-1", message: "Dismissible", type: "success" }],
    });
    render(<ToastContainer />);

    expect(screen.getByText("Dismissible")).toBeInTheDocument();

    const closeBtn = screen.getByRole("button", { name: "×" });
    await user.click(closeBtn);

    expect(screen.queryByText("Dismissible")).not.toBeInTheDocument();
  });

  it("renders multiple toasts simultaneously", () => {
    useWorkspaceStore.setState({
      toasts: [
        { id: "1", message: "Toast 1", type: "info" },
        { id: "2", message: "Toast 2", type: "success" },
        { id: "3", message: "Toast 3", type: "error" },
      ],
    });
    render(<ToastContainer />);

    expect(screen.getByText("Toast 1")).toBeInTheDocument();
    expect(screen.getByText("Toast 2")).toBeInTheDocument();
    expect(screen.getByText("Toast 3")).toBeInTheDocument();
  });
});
