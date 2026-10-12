import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DoctorCard } from "./doctor-card";
import { PatientSummary } from "./records";
import {
  APPOINTMENT_STATUS,
  AppointmentStatusBadge,
  LAB_RESULT_STATUS,
  LabResultStatusBadge,
  SERVICE_REQUEST_STATUS,
} from "./status";
import { StatusTimeline } from "./status-timeline";

describe("status vocabularies", () => {
  it("cover exactly the backend's database values", () => {
    expect(Object.keys(APPOINTMENT_STATUS).sort()).toEqual(
      ["CANCELLED", "COMPLETED", "CONFIRMED", "DECLINED", "PENDING", "RESCHEDULE_REQUESTED"],
    );
    expect(Object.keys(LAB_RESULT_STATUS).sort()).toEqual(["PENDING_REVIEW", "RELEASED", "RETURNED"]);
    expect(Object.keys(SERVICE_REQUEST_STATUS).sort()).toEqual(["CANCELLED", "IN_PROGRESS", "OPEN", "RESOLVED"]);
  });

  it("uses the reference wording", () => {
    render(
      <>
        <AppointmentStatusBadge status="CONFIRMED" />
        <LabResultStatusBadge status="PENDING_REVIEW" />
      </>,
    );
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
    expect(screen.getByText("Doctor review")).toBeInTheDocument();
  });

  it("renders unknown values neutrally instead of guessing", () => {
    render(<AppointmentStatusBadge status="NO_SHOW" />);
    expect(screen.getByText("no show")).toBeInTheDocument();
  });
});

describe("DoctorCard", () => {
  it("shows verification, availability and fee, with a uniquely named action", () => {
    render(
      <DoctorCard name="Dr. Mariama Cole" specialty="General medicine" focus="Adult primary care" nextAvailable="Today, 2:30 PM" fee="USD 35" approved href="/providers/mc" />,
    );
    const card = screen.getByRole("article");
    expect(within(card).getByRole("heading", { name: "Dr. Mariama Cole" })).toBeInTheDocument();
    expect(card).toHaveTextContent("Approved provider");
    expect(card).toHaveTextContent("Fee: USD 35");
    expect(within(card).getByRole("link", { name: "View profile: Dr. Mariama Cole" })).toHaveAttribute("href", "/providers/mc");
  });

  it("says when there are no open times", () => {
    render(<DoctorCard name="Dr. Samuel K. Doe" specialty="Pediatrics" href="/x" />);
    expect(screen.getByText("No open times")).toBeInTheDocument();
    expect(screen.queryByText("Approved provider")).not.toBeInTheDocument();
  });
});

describe("StatusTimeline", () => {
  it("speaks each state as text and marks the current step", () => {
    render(
      <StatusTimeline
        label="Specimen handoff"
        steps={[
          { id: "a", title: "Collected", detail: "09:18 · Collector JA", state: "complete" },
          { id: "b", title: "Handoff in progress", state: "current" },
          { id: "c", title: "Laboratory receipt", state: "pending", stateLabel: "Not yet received" },
        ]}
      />,
    );
    const steps = within(screen.getByRole("list", { name: "Specimen handoff" })).getAllByRole("listitem");
    expect(steps[0]).toHaveTextContent("Complete · 09:18 · Collector JA");
    expect(steps[1]).toHaveAttribute("aria-current", "step");
    expect(steps[2]).toHaveTextContent("Not yet received");
  });
});

describe("PatientSummary", () => {
  it("shows the patient reference and the restriction notice", () => {
    render(<PatientSummary patientReference="PT-10482" fields={[{ term: "Requested test", detail: "Complete blood count" }]} restriction="Unrelated records are hidden." />);
    expect(screen.getByText("PT-10482")).toBeInTheDocument();
    expect(screen.getByText("Restricted")).toBeInTheDocument();
    expect(screen.getByText("Unrelated records are hidden.")).toBeInTheDocument();
  });
});
