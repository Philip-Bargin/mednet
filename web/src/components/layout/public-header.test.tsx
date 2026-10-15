import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PublicHeader } from "./public-header";
import { PUBLIC_HEADER_LINKS } from "./public-nav";

vi.mock("next/navigation", () => ({ usePathname: () => "/about" }));

describe("PublicHeader", () => {
  it("links only to routes that exist", () => {
    render(<PublicHeader />);
    const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
    for (const planned of PUBLIC_HEADER_LINKS.filter((link) => link.href === null)) {
      expect(screen.queryByRole("link", { name: planned.label })).not.toBeInTheDocument();
    }
    expect(hrefs).not.toContain(null);
  });

  it("toggles the compact menu with an accessible button", async () => {
    render(<PublicHeader />);
    const button = screen.getByRole("button", { name: "Open menu" });
    const menu = document.getElementById("public-mobile-menu");

    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(menu).not.toBeVisible();

    await userEvent.click(button);

    expect(screen.getByRole("button", { name: "Close menu" })).toHaveAttribute("aria-expanded", "true");
    expect(menu).toBeVisible();
  });
});
