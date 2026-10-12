import { ArrowRight, Check, MessageSquareText } from "lucide-react";
import Link from "next/link";
import { AppointmentCard, AppointmentSummary } from "@/components/healthcare/appointment";
import { DoctorCard } from "@/components/healthcare/doctor-card";
import { MedicalRecordList, PatientSummary } from "@/components/healthcare/records";
import {
  AppointmentStatusBadge,
  LabResultStatusBadge,
  ServiceRequestStatusBadge,
} from "@/components/healthcare/status";
import { StatusTimeline } from "@/components/healthcare/status-timeline";
import { PublicFooter } from "@/components/layout/public-footer";
import { PublicHeader } from "@/components/layout/public-header";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader, SectionHeading } from "@/components/ui/card";
import { FictionalDataBadge } from "@/components/ui/fictional-data-badge";
import { ActivityList, ActivityRow, AuditEvent, DescriptionList, RestrictedNotice } from "@/components/ui/lists";
import { MetricCard, MetricGrid } from "@/components/ui/metric-card";
import { Breadcrumb, Stepper } from "@/components/ui/navigation";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { StateMessage } from "@/components/ui/state-message";
import { PermissionBoundary, WelcomeBand } from "@/components/workspace/workspace-sections";
import { WORKSPACES, WORKSPACE_IDS } from "@/features/workspace/workspaces";
import { ButtonDemo, FormDemo, NavigationDemo, OverlayDemo, TableDemo } from "./_showcase/demos";
import { sampleDoctors } from "./_showcase/fixtures";
import { ShowcaseSection, Specimen } from "./_showcase/section";

const swatches = [
  ["green-950", "Brand 950 · dark surfaces"],
  ["green-900", "Brand 900 · dashboard emphasis"],
  ["green-700", "Brand 700 · primary action"],
  ["green-100", "Brand 100 · selected surface"],
  ["green-50", "Brand 50 · subtle surface"],
  ["ink", "Neutral 950 · primary text"],
  ["ink-soft", "Neutral 600 · secondary text"],
  ["ink-faint", "Neutral 400 · muted text"],
  ["line", "Neutral 200 · borders"],
  ["surface-soft", "Neutral 50 · canvas"],
  ["info", "Info 700"],
  ["warning", "Warning 700"],
  ["critical", "Critical 700"],
] as const;

const typeScale = [
  ["text-display", "Display · 56/60", "Care with clarity."],
  ["text-h1", "Heading 1 · 40/48", "Your health information"],
  ["text-h2", "Heading 2 · 28/36", "Upcoming appointment"],
  ["text-title", "Card title · 21/32 regular", "Today at 2:30 PM"],
  ["text-body", "Body · 16/24", "Review your appointment information and complete required steps."],
  ["text-data", "Data · 14/20", "12 Aug 2025 · USD 35.00"],
  ["text-caption", "Caption · 13/18", "Follow-up consultation · 8 August"],
] as const;

const sections = [
  ["tokens", "Tokens"],
  ["typography", "Typography"],
  ["buttons", "Buttons"],
  ["forms", "Forms"],
  ["badges-alerts", "Badges and alerts"],
  ["cards", "Cards and metrics"],
  ["navigation", "Navigation"],
  ["tables", "Tables and filters"],
  ["overlays", "Overlays"],
  ["states", "States"],
  ["healthcare", "Healthcare"],
  ["workspaces", "Workspace shells"],
] as const;

export default function FoundationPage() {
  return (
    <>
      <PublicHeader />
      <main id="main-content" className="mx-auto max-w-page space-y-10 px-4 py-10 md:px-6 lg:px-8">
        <header className="space-y-3">
          <p className="text-eyebrow font-bold tracking-[0.1em] text-action uppercase">Development only · not a product page</p>
          <h1 className="text-h1 font-semibold text-ink">MedNet design system</h1>
          <p className="max-w-3xl text-text-secondary">
            Components implemented from the approved Figma reference. Each section names where the component appears in the
            reference. See docs/DESIGN_SYSTEM.md for variants and documented interpretations.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <FictionalDataBadge />
            <span className="text-caption text-text-muted">All examples use the reference&apos;s fictional demonstration data.</span>
          </div>
          <nav aria-label="Showcase sections">
            <ul className="flex flex-wrap gap-2 pt-2">
              {sections.map(([id, label]) => (
                <li key={id}>
                  <a href={`#${id}`} className="inline-flex min-h-9 items-center rounded-full border border-border bg-surface px-3 text-caption font-semibold text-green-800 hover:border-action">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </header>

        <ShowcaseSection id="tokens" title="Colour tokens" reference="Design system · Foundations · 01 Colour">
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
            {swatches.map(([token, label]) => (
              <li key={token} className="overflow-hidden rounded-md border border-border bg-surface">
                <div className="h-14" style={{ background: `var(--color-${token})` }} />
                <div className="p-3">
                  <p className="text-data font-semibold">{token}</p>
                  <p className="text-caption text-text-secondary">{label}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-4">
            <span className="inline-flex size-16 items-center justify-center rounded-sm border border-border bg-surface text-caption">8px</span>
            <span className="inline-flex size-16 items-center justify-center rounded-md border border-border bg-surface text-caption shadow-card">12px</span>
            <span className="inline-flex h-16 w-28 items-center justify-center rounded-md bg-surface text-caption shadow-overlay">Overlay</span>
          </div>
        </ShowcaseSection>

        <ShowcaseSection id="typography" title="Typography · Source Sans 3" reference="Design system · Foundations · 02 Typography">
          <ul className="space-y-4 rounded-md border border-border bg-surface p-5 md:p-6">
            {typeScale.map(([className, label, sample]) => (
              <li key={label} className="grid gap-1 md:grid-cols-[13rem_1fr] md:items-baseline">
                <span className="text-caption text-text-muted">{label}</span>
                <span className={`${className} text-ink [overflow-wrap:anywhere] ${className.startsWith("text-d") || className.startsWith("text-h") ? "font-semibold" : ""}`}>
                  {sample}
                </span>
              </li>
            ))}
          </ul>
          <SectionHeading eyebrow="Care for everyday needs" title="Section heading (rendered regular weight)" description="Used above groups of cards in public and workspace pages." />
        </ShowcaseSection>

        <ShowcaseSection id="buttons" title="Buttons and actions" reference="Design system · Components · Buttons; welcome band action">
          <ButtonDemo />
          <Specimen label="Long label at narrow widths wraps instead of clipping (reference defect fixed)">
            <div className="max-w-[11rem]">
              <Button fullWidth>Prepare for your visit today</Button>
            </div>
          </Specimen>
          <Specimen label="Links styled as buttons, and the inverse button on the welcome band">
            <div className="flex flex-wrap items-center gap-3 rounded-md bg-emphasis p-5">
              <ButtonLink href="#buttons" variant="inverse" trailingIcon={<ArrowRight aria-hidden size={18} strokeWidth={1.8} />}>
                Find a doctor
              </ButtonLink>
            </div>
          </Specimen>
        </ShowcaseSection>

        <ShowcaseSection id="forms" title="Form elements and validation" reference="Design system · Components · Form fields, Selection controls">
          <Card>
            <FormDemo />
          </Card>
        </ShowcaseSection>

        <ShowcaseSection id="badges-alerts" title="Badges and alerts" reference="Design system · Components · Status, Feedback">
          <Specimen label="Status tones">
            <div className="flex flex-wrap gap-2">
              <Badge tone="success">Confirmed</Badge>
              <Badge tone="info">Available</Badge>
              <Badge tone="warning">Doctor review</Badge>
              <Badge tone="critical">Action required</Badge>
              <Badge tone="neutral">Private</Badge>
            </div>
          </Specimen>
          <Specimen label="Backend status vocabularies (appointments · lab results · service requests)">
            <div className="flex flex-wrap gap-2">
              {["PENDING", "CONFIRMED", "RESCHEDULE_REQUESTED", "DECLINED", "CANCELLED", "COMPLETED"].map((status) => (
                <AppointmentStatusBadge key={status} status={status} />
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {["PENDING_REVIEW", "RELEASED", "RETURNED"].map((status) => (
                <LabResultStatusBadge key={status} status={status} />
              ))}
              {["OPEN", "IN_PROGRESS", "RESOLVED", "CANCELLED"].map((status) => (
                <ServiceRequestStatusBadge key={status} status={status} />
              ))}
            </div>
          </Specimen>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Alert tone="info" title="Information">Your appointment time is shown in your local timezone.</Alert>
            <Alert tone="warning" title="Review needed">This result is waiting for an authorized doctor.</Alert>
            <Alert tone="critical" title="Connection interrupted" action={<Button size="sm" variant="secondary">Retry</Button>}>
              Your note is saved locally. Reconnect before finalizing.
            </Alert>
            <Alert tone="success" title="Your information is protected">
              Only authorized members of your care team can access your clinical information.
            </Alert>
          </div>
        </ShowcaseSection>

        <ShowcaseSection id="cards" title="Cards, metrics and lists" reference="Patient dashboard panels; Operations metric cards, queues, audit logs">
          <WelcomeBand
            eyebrow="Your care at a glance"
            title="Everything is ready for your next visit."
            action={<ButtonLink href="#cards" variant="inverse" trailingIcon={<ArrowRight aria-hidden size={18} strokeWidth={1.8} />}>Find a doctor</ButtonLink>}
          />
          <MetricGrid>
            <MetricCard tone="warning" value="18" label="Open tasks" hint="5 due today" />
            <MetricCard tone="info" value="7" label="Onboarding reviews" hint="Within assigned scope" />
            <MetricCard tone="critical" value="11" label="Service issues" hint="3 escalated" />
            <MetricCard tone="success" value="94%" label="Tasks within SLA" hint="Last 7 days" />
          </MetricGrid>
          <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr] lg:items-start">
            <Card>
              <CardHeader eyebrow="Operations queue" title="Priority work" />
              <ActivityList label="Priority work">
                <ActivityRow marker="V" title="Provider onboarding review" meta="Doctor DR-208 · Identity complete" trailing={<Badge tone="warning">Due today</Badge>} />
                <ActivityRow marker="A" title="Appointment service issue" meta="APT-3084 · Provider unavailable" trailing={<Badge tone="critical">Escalated</Badge>} />
                <ActivityRow marker="P" title="Partner availability update" meta="LAB-17 · Test catalogue change" trailing={<Badge tone="info">Review</Badge>} />
              </ActivityList>
            </Card>
            <Card>
              <CardHeader eyebrow="For you" title="2 actions to complete" />
              <ActivityList label="Actions to complete">
                <ActivityRow icon={Check} tileTone="warning" title="Confirm virtual care consent" meta="Required before today’s visit" href="#cards" />
                <ActivityRow icon={MessageSquareText} tileTone="info" title="Reply to your doctor" meta="One new clinical message" href="#cards" />
              </ActivityList>
            </Card>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader eyebrow="Security" title="Recent access events" />
              <ul className="mt-2 divide-y divide-line-soft">
                <AuditEvent time="09:42" title="Role assignment changed" actor="Super admin SA-03 · User AD-12" />
                <AuditEvent time="09:11" title="Break-glass request denied" actor="Reason incomplete · Doctor DR-104" />
                <AuditEvent time="08:26" title="Integration key rotated" actor="Super admin SA-01 · Payment service" />
              </ul>
            </Card>
            <PermissionBoundary
              allowed="Provider onboarding, service issue coordination, scoped operational reports."
              approvalRequired="Account suspension, exceptional refund, organization status change."
              notAvailable="Technical configuration, clinical record editing, result release, role-policy changes."
            />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Avatar name="James Brown" size="sm" />
            <Avatar name="James Brown" />
            <Avatar name="Dr. Mariama Cole" size="lg" />
          </div>
        </ShowcaseSection>

        <ShowcaseSection id="navigation" title="Navigation controls" reference="Tabs/Underline, Segmented control, Menu/Action, Pagination, Breadcrumb, booking progress">
          <Breadcrumb items={[{ label: "Laboratory", href: "#navigation" }, { label: "Orders", href: "#navigation" }, { label: "LAB-1042" }]} />
          <Stepper steps={["Find care", "Profile", "Schedule", "Sign in", "Review", "Confirmed"]} current={2} label="Booking progress" />
          <NavigationDemo />
        </ShowcaseSection>

        <ShowcaseSection id="tables" title="Tables, search and filters" reference="Operations · Laboratory order queue; Search and filter pattern">
          <Card>
            <CardHeader eyebrow="Assigned work" title="Laboratory order queue" action={<FictionalDataBadge />} />
            <div className="mt-5">
              <TableDemo />
            </div>
          </Card>
        </ShowcaseSection>

        <ShowcaseSection id="overlays" title="Dialogs, drawers and toasts" reference="Dialog/Confirmation, Drawer/Detail, Toast/Success">
          <OverlayDemo />
        </ShowcaseSection>

        <ShowcaseSection id="states" title="Standard interface states" reference="State strip on every workspace (loading, empty, error, success, permission denied)">
          <div className="grid gap-2 md:grid-cols-5">
            <StateMessage layout="inline" kind="loading" title="Loading queue" />
            <StateMessage layout="inline" kind="empty" title="Empty: no assigned work" />
            <StateMessage layout="inline" kind="error" title="Error: retry failed sync" />
            <StateMessage layout="inline" kind="success" title="Success: action recorded" />
            <StateMessage layout="inline" kind="denied" title="Permission denied" />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <StateMessage kind="empty" title="No earlier visits" description="Completed consultations will appear here." />
            <StateMessage kind="error" title="We could not load your appointments" description="The MedNet API is unavailable. Try again shortly." action={<Button variant="secondary">Try again</Button>} />
            <StateMessage kind="denied" title="You do not have access" description="This record is only available within an authorized care relationship." />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <SkeletonCard label="Loading appointments" />
            <div className="space-y-3 rounded-md border border-border bg-surface p-5">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
            <p className="inline-flex items-center gap-2 self-start text-action">
              <Spinner label="Loading" /> <span className="text-data text-text-secondary">Inline spinner</span>
            </p>
          </div>
        </ShowcaseSection>

        <ShowcaseSection id="healthcare" title="Healthcare components" reference="Healthcare preview; patient and doctor dashboards; laboratory and collection workspaces">
          <ul className="grid gap-4 md:grid-cols-3">
            {sampleDoctors.data.map((doctor) => (
              <li key={doctor.id}>
                <DoctorCard {...doctor} approved href="#healthcare" />
              </li>
            ))}
          </ul>
          <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr] lg:items-start">
            <AppointmentSummary
              when="Today at 2:30 PM"
              status="CONFIRMED"
              doctorName="Dr. Mariama Cole"
              specialty="General medicine"
              mode="Video consultation"
              details={[
                { term: "Date", detail: "12 August 2025" },
                { term: "Duration", detail: "30 minutes" },
                { term: "Fixed cost", detail: "USD 35 (information only)" },
              ]}
              actions={
                <>
                  <Button>Prepare for visit</Button>
                  <Button variant="secondary">View details</Button>
                </>
              }
            />
            <div className="space-y-4">
              <AppointmentCard day="12" month="Aug" status="CONFIRMED" mode="Video consultation" doctorName="Dr. Mariama Cole" time="2:30 PM" action={<Button size="sm" variant="secondary">Prepare</Button>} />
              <Card>
                <CardHeader eyebrow="Order detail" title="LAB-1042" action={<ServiceRequestStatusBadge status="OPEN" />} />
                <div className="mt-4">
                  <PatientSummary
                    patientReference="PT-10482"
                    fields={[
                      { term: "Requested test", detail: "Complete blood count" },
                      { term: "Requesting doctor", detail: "Dr. Mariama Cole" },
                      { term: "Authorized context", detail: "Fatigue assessment" },
                      { term: "Estimated turnaround", detail: "24 hours" },
                    ]}
                    restriction="Only order-relevant clinical context is available. Unrelated records and prior results are hidden."
                  />
                </div>
              </Card>
            </div>
          </div>
          <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr] lg:items-start">
            <Card>
              <CardHeader eyebrow="Medical information" title="Recent activity" />
              <MedicalRecordList
                records={[
                  { id: "1", kind: "visit-summary", title: "Visit summary", meta: "Follow-up consultation · 8 August", status: <Badge tone="info">Available</Badge> },
                  { id: "2", kind: "lab-result", title: "Complete blood count", meta: "Laboratory result · 7 August", status: <LabResultStatusBadge status="PENDING_REVIEW" /> },
                  { id: "3", kind: "prescription", title: "Prescription available", meta: "Issued after consultation · 8 August", status: <Badge tone="neutral">Private</Badge> },
                  { id: "4", kind: "consultation", title: "Consultation history", meta: "Dr. Mariama Cole · Completed 8 August", status: <AppointmentStatusBadge status="COMPLETED" /> },
                ]}
              />
            </Card>
            <Card>
              <CardHeader eyebrow="Specimen MN-LAB-1042" title="Complete blood count" action={<Badge tone="info">In transit</Badge>} />
              <div className="mt-5">
                <StatusTimeline
                  label="Specimen handoff"
                  steps={[
                    { id: "collected", title: "Collected", detail: "09:18 · Collector JA", state: "complete" },
                    { id: "handoff", title: "Handoff in progress", detail: "Offline event pending sync", state: "current" },
                    { id: "receipt", title: "Laboratory receipt", state: "pending", stateLabel: "Not yet received" },
                  ]}
                />
              </div>
            </Card>
          </div>
          <Card>
            <CardHeader eyebrow="Specimen and result workflow" title="Processing stages" />
            <div className="mt-5">
              <StatusTimeline
                orientation="horizontal"
                label="Laboratory processing stages"
                steps={[
                  { id: "1", title: "Order accepted", state: "complete" },
                  { id: "2", title: "Awaiting collection", state: "current" },
                  { id: "3", title: "Received and checked", state: "pending" },
                  { id: "4", title: "Test in progress", state: "pending" },
                  { id: "5", title: "Result entered", state: "pending", stateLabel: "Not validated" },
                  { id: "6", title: "Professional validation", state: "required" },
                  { id: "7", title: "Released to doctor", state: "locked" },
                ]}
              />
            </div>
            <div className="mt-5">
              <RestrictedNotice label="Upload does not equal validation">
                A result file remains a draft until an authorized laboratory professional validates and releases it to the ordering doctor.
              </RestrictedNotice>
            </div>
          </Card>
          <Card>
            <CardHeader eyebrow="Selected record" title="LAB-1042" />
            <DescriptionList
              className="mt-4"
              columns={3}
              items={[
                { term: "Owner", detail: "Laboratory" },
                { term: "Last updated", detail: "Today · 10:24" },
                { term: "Audit reference", detail: "AUD-10428" },
              ]}
            />
          </Card>
        </ShowcaseSection>

        <ShowcaseSection id="workspaces" title="Workspace shells" reference="Patient dashboard, Doctor dashboard, Operations (9 workspaces)">
          <ul className="grid gap-3 md:grid-cols-3">
            {WORKSPACE_IDS.map((id) => (
              <li key={id}>
                <Link
                  href={`/foundation/workspace/${id}`}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-border bg-surface px-4 py-3 font-semibold text-green-900 hover:border-action"
                >
                  {WORKSPACES[id].label}
                  <span className="text-caption font-normal text-text-muted">{WORKSPACES[id].backendRole ?? "no backend role"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </ShowcaseSection>
      </main>
      <PublicFooter />
    </>
  );
}
