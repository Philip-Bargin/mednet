import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Alert } from "./alert";
import { Badge } from "./badge";
import { Button, ButtonLink, buttonClasses } from "./button";
import { IconButton } from "./icon-button";
import { Checkbox, RadioGroup, SearchInput, SelectField, Switch, TextArea, TextInput } from "./inputs";
import { StateMessage, type StateKind } from "./state-message";

describe("Button", () => {
  it("renders each reference variant with its token classes", () => {
    expect(buttonClasses({ variant: "primary" })).toContain("bg-action");
    expect(buttonClasses({ variant: "secondary" })).toContain("border-action-border");
    expect(buttonClasses({ variant: "tertiary" })).toContain("bg-transparent");
    expect(buttonClasses({ variant: "destructive" })).toContain("text-critical");
    expect(buttonClasses({ variant: "inverse" })).toContain("bg-surface");
  });

  it("meets the 44px patient and 40px professional target sizes", () => {
    expect(buttonClasses({ size: "md" })).toContain("min-h-11");
    expect(buttonClasses({ size: "sm" })).toContain("min-h-10");
  });

  it("lets labels wrap instead of clipping", () => {
    const classes = buttonClasses();
    expect(classes).toContain("whitespace-normal");
    expect(classes.split(" ")).not.toContain("h-11");
    expect(classes).not.toMatch(/truncate|overflow-hidden/);
  });

  it("defaults to type=button so it never submits forms by accident", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("type", "button");
  });

  it("blocks clicks while loading and exposes the busy state", async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save preferences
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Save preferences" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("is skipped by keyboard focus when disabled", async () => {
    render(
      <>
        <Button disabled>Disabled</Button>
        <Button>Next</Button>
      </>,
    );
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Next" })).toHaveFocus();
  });

  it("renders navigation as a link", () => {
    render(<ButtonLink href="/services">Find a doctor</ButtonLink>);
    expect(screen.getByRole("link", { name: "Find a doctor" })).toHaveAttribute("href", "/services");
  });

  it("requires an accessible name on icon buttons", () => {
    render(<IconButton label="Search" icon={<svg />} indicator />);
    expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
  });
});

describe("form fields", () => {
  it("associates label and description with the input", () => {
    render(<TextInput label="Patient name" description="As shown on identification" />);
    const input = screen.getByRole("textbox", { name: "Patient name" });
    expect(input).toHaveAccessibleDescription("As shown on identification");
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("presents validation errors on the control", () => {
    render(<TextInput label="Mobile number" required error="Enter a complete mobile number." />);
    const input = screen.getByRole("textbox", { name: /Mobile number/ });
    expect(input).toBeRequired();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Enter a complete mobile number.");
  });

  it("labels textarea, select and search controls", () => {
    render(
      <>
        <TextArea label="Reason for visit" />
        <SelectField label="Specialty" options={[{ value: "gm", label: "General medicine" }]} />
        <SearchInput label="Search orders" placeholder="Search" />
      </>,
    );
    expect(screen.getByRole("textbox", { name: "Reason for visit" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Specialty" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search orders" })).toBeInTheDocument();
  });

  it("toggles checkbox, switch and radio with the keyboard", async () => {
    const onMode = vi.fn();
    render(
      <>
        <Checkbox label="Remember this device" />
        <Switch label="Notifications on" />
        <RadioGroup legend="Consultation mode" name="mode" defaultValue="video" onChange={onMode} options={[{ value: "video", label: "Video" }, { value: "audio", label: "Audio" }]} />
      </>,
    );
    await userEvent.tab();
    await userEvent.keyboard(" ");
    expect(screen.getByRole("checkbox", { name: "Remember this device" })).toBeChecked();
    await userEvent.tab();
    await userEvent.keyboard(" ");
    expect(screen.getByRole("switch", { name: "Notifications on" })).toBeChecked();
    await userEvent.click(screen.getByRole("radio", { name: "Audio" }));
    expect(onMode).toHaveBeenCalledWith("audio");
    expect(screen.getByRole("group", { name: "Consultation mode" })).toBeInTheDocument();
  });
});

describe("Badge and Alert", () => {
  it("always carries text, not colour alone", () => {
    render(<Badge tone="warning">Doctor review</Badge>);
    expect(screen.getByText("Doctor review")).toBeVisible();
  });

  it("is static by default and announces only when asked", () => {
    const { rerender } = render(<Alert tone="critical" title="Connection interrupted" />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    rerender(<Alert tone="critical" live="assertive" title="Connection interrupted" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Connection interrupted");
    rerender(<Alert tone="info" live="polite" title="Information" />);
    expect(screen.getByRole("status")).toHaveTextContent("Information");
  });
});

describe("StateMessage", () => {
  const transient: Array<[StateKind, "status" | "alert"]> = [
    ["loading", "status"],
    ["error", "alert"],
    ["success", "status"],
  ];

  it.each(["empty", "denied"] as const)("keeps the steady %s state out of live regions unless asked", (kind) => {
    const { rerender } = render(<StateMessage kind={kind} title="Steady" />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText("Steady")).toBeVisible();
    rerender(<StateMessage kind={kind} title="Steady" live />);
    expect(screen.getByRole("status")).toHaveTextContent("Steady");
  });

  it.each(transient)("announces the transient %s state with role %s in both layouts", (kind, role) => {
    const { unmount } = render(<StateMessage kind={kind} title={`${kind} title`} layout="inline" />);
    expect(screen.getByRole(role)).toHaveTextContent(`${kind} title`);
    unmount();
    render(<StateMessage kind={kind} title={`${kind} panel`} description="More detail" />);
    expect(screen.getByRole(role)).toHaveTextContent(`${kind} panel`);
  });
});
