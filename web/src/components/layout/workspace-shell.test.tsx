import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { initials } from "@/components/ui/avatar";
import { WorkspaceShell } from "./workspace-shell";

const pathname = vi.hoisted(() => ({ current: "/patient/appointments" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

describe("WorkspaceShell", () => {
  it("renders workspace navigation with the current page marked", () => {
    render(
      <WorkspaceShell
        workspaceId="patient"
        user={{ name: "James Brown", description: "Patient account" }}
        eyebrow="Monday, 12 August"
        title="Good morning, James"
      >
        <p>Content</p>
      </WorkspaceShell>,
    );

    const nav = screen.getByRole("navigation", { name: "Patient workspace" });
    const current = within(nav).getByRole("link", { name: "Appointments" });
    expect(current).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("heading", { level: 1, name: "Good morning, James" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("Content");
    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveAttribute(
      "href",
      "#workspace-content",
    );
  });

  it("numbers operations navigation instead of using icons", () => {
    pathname.current = "/admin";
    render(
      <WorkspaceShell
        workspaceId="admin"
        user={{ name: "Operations Reviewer", description: "Administrator" }}
        title="Administrator"
      >
        <p>Content</p>
      </WorkspaceShell>,
    );

    const nav = screen.getByRole("navigation", { name: "Administrator workspace" });
    const links = within(nav).getAllByRole("link");
    expect(links[0]).toHaveTextContent("01");
    expect(links[0]).toHaveAccessibleName("Overview");
    expect(links[0]).toHaveAttribute("aria-current", "page");
  });
});

describe("initials", () => {
  it("drops honorifics and uses first and last names", () => {
    expect(initials("Dr. Mariama Cole")).toBe("MC");
    expect(initials("James Brown")).toBe("JB");
    expect(initials("Samuel K. Doe")).toBe("SD");
  });
});
