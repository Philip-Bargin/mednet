import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DataTable } from "./data-table";
import { FilterBar } from "./filter-bar";
import { Menu } from "./menu";
import { Stepper } from "./navigation";
import { Pagination, pageWindow } from "./pagination";
import { SegmentedControl } from "./segmented-control";
import { Tabs } from "./tabs";
import { InfoTip } from "./tooltip";

describe("Tabs", () => {
  const items = [
    { id: "summary", label: "Summary", content: "Summary panel" },
    { id: "specimen", label: "Specimen", content: "Specimen panel" },
    { id: "activity", label: "Activity", content: "Activity panel" },
  ];

  it("moves selection with arrow, Home and End keys and keeps one tab stop", async () => {
    render(<Tabs label="Order sections" items={items} />);
    const [summary, specimen, activity] = screen.getAllByRole("tab");
    expect(summary).toHaveAttribute("aria-selected", "true");
    expect(specimen).toHaveAttribute("tabindex", "-1");

    await userEvent.tab();
    expect(summary).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    expect(specimen).toHaveFocus();
    expect(specimen).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Specimen panel");

    await userEvent.keyboard("{End}");
    expect(activity).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    expect(summary).toHaveFocus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(activity).toHaveFocus();
  });
});

describe("Menu", () => {
  it("opens from the keyboard, skips disabled items, and returns focus on Escape", async () => {
    const onFinance = vi.fn();
    render(
      <Menu
        label="Escalate to…"
        items={[
          { id: "admin", label: "Administration", onSelect: vi.fn() },
          { id: "clinical", label: "Clinical review", onSelect: vi.fn(), disabled: true },
          { id: "finance", label: "Finance", onSelect: onFinance },
        ]}
      />,
    );
    const trigger = screen.getByRole("button", { name: "Escalate to…" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    trigger.focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await vi.waitFor(() => expect(screen.getByRole("menuitem", { name: "Administration" })).toHaveFocus());

    await userEvent.keyboard("{ArrowDown}");
    const disabled = screen.getByRole("menuitem", { name: "Clinical review" });
    expect(disabled).toHaveFocus();
    expect(disabled).toHaveAttribute("aria-disabled", "true");
    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Finance" })).toHaveFocus();

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    await userEvent.click(trigger);
    await userEvent.click(await screen.findByRole("menuitem", { name: "Finance" }));
    expect(onFinance).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});

describe("Pagination", () => {
  it("builds a compact window with gaps", () => {
    expect(pageWindow(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(6, 12)).toEqual([1, null, 5, 6, 7, null, 12]);
    expect(pageWindow(1, 12)).toEqual([1, 2, null, 12]);
  });

  it("marks the current page and keeps focus on a disabled previous button", async () => {
    const onChange = vi.fn();
    render(<Pagination page={1} totalPages={4} onPageChange={onChange} />);
    const previous = screen.getByRole("button", { name: "Previous page" });
    expect(previous).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(previous);
    expect(onChange).not.toHaveBeenCalled();
    expect(previous).toHaveFocus();
    expect(screen.getByRole("button", { name: "Page 1" })).toHaveAttribute("aria-current", "page");
    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("renders nothing for a single page", () => {
    const { container } = render(<Pagination page={1} totalPages={1} onPageChange={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("DataTable", () => {
  type Row = { id: string; test: string };
  const columns = [
    { id: "id", header: "Order", primary: true, cell: (row: Row) => row.id },
    { id: "test", header: "Test", cell: (row: Row) => row.test },
  ];

  it("renders a captioned table with column headers", () => {
    render(<DataTable caption="Laboratory order queue" columns={columns} rows={[{ id: "LAB-1", test: "CBC" }]} rowKey={(row) => row.id} selectedKey="LAB-1" />);
    const table = screen.getByRole("table", { name: "Laboratory order queue" });
    expect(within(table).getAllByRole("columnheader").map((th) => th.textContent)).toEqual(["Order", "Test"]);
    expect(within(table).getAllByRole("row")[1]).toHaveAttribute("aria-current", "true");
  });

  it("shows the empty state and the loading state", () => {
    const { rerender } = render(
      <DataTable caption="Orders" columns={columns} rows={[]} rowKey={(row) => row.id} empty={{ title: "No assigned work" }} />,
    );
    expect(screen.getByText("No assigned work")).toBeVisible();
    rerender(<DataTable caption="Orders" columns={columns} rows={[]} rowKey={(row) => row.id} loading />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading orders");
  });
});

describe("FilterBar", () => {
  it("lists applied filters as removable buttons and announces the result count", async () => {
    const onRemove = vi.fn();
    render(<FilterBar applied={[{ id: "status", label: "Status: open" }]} onRemove={onRemove} resultCount="3 of 4 orders" />);
    expect(screen.getByRole("search")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Remove filter: Status: open" }));
    expect(onRemove).toHaveBeenCalledWith("status");
    expect(screen.getByText("3 of 4 orders")).toHaveAttribute("aria-live", "polite");
  });
});

describe("SegmentedControl", () => {
  it("behaves as a labelled radio group", async () => {
    const onChange = vi.fn();
    render(<SegmentedControl legend="Queue scope" value="assigned" onChange={onChange} options={[{ value: "assigned", label: "Assigned to me" }, { value: "all", label: "All" }]} />);
    expect(screen.getByRole("group", { name: "Queue scope" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Assigned to me" })).toBeChecked();
    await userEvent.click(screen.getByText("All"));
    expect(onChange).toHaveBeenCalledWith("all");
  });
});

describe("InfoTip", () => {
  it("is always described, shows on focus, and hides on Escape", async () => {
    render(<InfoTip label="About the MedNet fee">Rate not displayed.</InfoTip>);
    const trigger = screen.getByRole("button", { name: "About the MedNet fee" });
    expect(trigger).toHaveAccessibleDescription("Rate not displayed.");
    await userEvent.tab();
    expect(screen.getByRole("tooltip")).toBeVisible();
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("tooltip", { hidden: true })).not.toBeVisible();
  });

  it("opens on click or tap even though focus already opened it", async () => {
    render(<InfoTip label="About the MedNet fee">Rate not displayed.</InfoTip>);
    await userEvent.click(screen.getByRole("button", { name: "About the MedNet fee" }));
    expect(screen.getByRole("tooltip")).toBeVisible();
  });

  it("closes on Escape when opened by hover", async () => {
    render(<InfoTip label="About the MedNet fee">Rate not displayed.</InfoTip>);
    await userEvent.hover(screen.getByRole("button", { name: "About the MedNet fee" }));
    expect(screen.getByRole("tooltip")).toBeVisible();
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("tooltip", { hidden: true })).not.toBeVisible();
  });
});

describe("Tabs fallback", () => {
  it("keeps the tab list keyboard-reachable when the requested tab does not exist", () => {
    render(
      <Tabs
        label="Sections"
        value="missing"
        items={[
          { id: "a", label: "A", content: "Panel A" },
          { id: "b", label: "B", content: "Panel B" },
        ]}
      />,
    );
    expect(screen.getByRole("tab", { name: "A" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Panel A");
  });
});

describe("Stepper", () => {
  it("marks the current step and announces progress", () => {
    render(<Stepper steps={["Find care", "Profile", "Schedule"]} current={1} label="Booking progress" />);
    const nav = screen.getByRole("navigation", { name: "Booking progress" });
    expect(within(nav).getAllByRole("listitem")[1]).toHaveAttribute("aria-current", "step");
    expect(nav).toHaveTextContent("Step 2 of 3: Profile");
  });
});
