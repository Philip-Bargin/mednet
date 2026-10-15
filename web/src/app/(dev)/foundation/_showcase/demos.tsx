"use client";

import { ArrowRight, Bell, Search } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { ServiceRequestStatusBadge } from "@/components/healthcare/status";
import { Button } from "@/components/ui/button";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { ConfirmDialog, Dialog, Drawer } from "@/components/ui/dialog";
import { FilterBar } from "@/components/ui/filter-bar";
import { IconButton } from "@/components/ui/icon-button";
import { Checkbox, RadioGroup, SearchInput, SelectField, Switch, TextArea, TextInput } from "@/components/ui/inputs";
import { DescriptionList } from "@/components/ui/lists";
import { Menu } from "@/components/ui/menu";
import { Pagination } from "@/components/ui/pagination";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Tabs } from "@/components/ui/tabs";
import { ToastRegion, useToasts } from "@/components/ui/toast";
import { InfoTip } from "@/components/ui/tooltip";
import { sampleOrders, type SampleOrder } from "./fixtures";

export function ButtonDemo() {
  const [loading, setLoading] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button trailingIcon={<ArrowRight aria-hidden size={18} strokeWidth={1.8} />}>Primary action</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="tertiary">Tertiary</Button>
      <Button variant="destructive">Cancel appointment</Button>
      <Button disabled>Disabled</Button>
      <Button
        variant="secondary"
        loading={loading}
        onClick={() => {
          setLoading(true);
          window.setTimeout(() => setLoading(false), 1500);
        }}
      >
        Save preferences
      </Button>
      <Button size="sm" variant="secondary">
        Small (professional)
      </Button>
      <IconButton label="Search" icon={<Search aria-hidden size={18} strokeWidth={1.8} />} />
      <IconButton label="Notifications, 2 unread" indicator icon={<Bell aria-hidden size={18} strokeWidth={1.8} />} />
    </div>
  );
}

export function FormDemo() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next: Record<string, string> = {};
    if (!String(data.get("name") ?? "").trim()) next.name = "Enter the patient name as shown on identification.";
    if (!/^\+?\d{9,15}$/.test(String(data.get("phone") ?? "").replace(/\s/g, ""))) next.phone = "Enter a complete mobile number.";
    if (!data.get("specialty")) next.specialty = "Choose a specialty.";
    setErrors(next);
    setSubmitted(Object.keys(next).length === 0);
  }

  return (
    <form noValidate onSubmit={onSubmit} className="grid gap-5 md:grid-cols-2" aria-label="Sample booking details">
      <TextInput name="name" label="Patient name" description="As shown on identification" required error={errors.name} autoComplete="name" />
      <SelectField
        name="specialty"
        label="Specialty"
        required
        defaultValue=""
        placeholder="Choose a specialty"
        error={errors.specialty}
        options={[
          { value: "general", label: "General medicine" },
          { value: "pediatrics", label: "Pediatrics" },
          { value: "womens-health", label: "Women’s health" },
        ]}
      />
      <TextInput name="phone" type="tel" label="Mobile number" inputMode="tel" autoComplete="tel" required error={errors.phone} />
      <TextInput name="disabled" label="Booking reference" value="APT-3084" disabled readOnly description="Assigned after confirmation" />
      <TextArea name="reason" label="Reason for visit" description="Optional. Shared only with your doctor." fieldClassName="md:col-span-2" />
      <RadioGroup legend="Consultation mode" name="mode" defaultValue="video" options={[{ value: "video", label: "Video" }, { value: "audio", label: "Audio" }]} />
      <div className="flex flex-col">
        <Checkbox name="remember" label="Remember this device" />
        <Switch name="notifications" label="Notifications on" defaultChecked />
      </div>
      <div className="flex flex-wrap items-center gap-3 md:col-span-2">
        <Button type="submit">Review details</Button>
        {submitted ? <p role="status" className="text-data font-semibold text-action">Details look complete.</p> : null}
      </div>
    </form>
  );
}

export function NavigationDemo() {
  const [mode, setMode] = useState("assigned");
  const [page, setPage] = useState(3);
  const [lastAction, setLastAction] = useState<string | null>(null);
  return (
    <div className="space-y-8">
      <Tabs
        label="Order detail sections"
        items={[
          { id: "summary", label: "Summary", content: <p className="text-text-secondary">Requested test, patient reference and requesting doctor.</p> },
          { id: "specimen", label: "Specimen", content: <p className="text-text-secondary">Specimen requirements and receipt checks.</p> },
          { id: "activity", label: "Activity", content: <p className="text-text-secondary">Audit-safe activity for this order.</p> },
        ]}
      />
      <div className="flex flex-wrap items-center gap-6">
        <SegmentedControl
          legend="Queue scope"
          value={mode}
          onChange={setMode}
          options={[
            { value: "assigned", label: "Assigned to me" },
            { value: "team", label: "My team" },
            { value: "all", label: "All" },
          ]}
        />
        <Menu
          label="Escalate to…"
          items={[
            { id: "administration", label: "Administration", onSelect: () => setLastAction("Administration") },
            { id: "finance", label: "Finance", onSelect: () => setLastAction("Finance") },
            { id: "clinical", label: "Clinical review (not available)", onSelect: () => undefined, disabled: true },
          ]}
        />
        <p className="inline-flex items-center gap-1 text-data text-text-secondary">
          MedNet fee: rate not displayed
          <InfoTip label="About the MedNet fee">Fees are defined by the transaction rule and are not shown here.</InfoTip>
        </p>
      </div>
      {lastAction ? <p role="status" className="text-caption text-text-secondary">Selected: {lastAction}</p> : null}
      <Pagination page={page} totalPages={12} onPageChange={setPage} />
    </div>
  );
}

const columns: DataColumn<SampleOrder>[] = [
  { id: "order", header: "Order", primary: true, cell: (row) => <span className="font-semibold">{row.id}</span> },
  { id: "patient", header: "Patient", cell: (row) => row.patient },
  { id: "test", header: "Test", cell: (row) => row.test },
  { id: "status", header: "Status", cell: (row) => <ServiceRequestStatusBadge status={row.status} /> },
  { id: "requested", header: "Requested", cell: (row) => row.requestedBy },
  { id: "turnaround", header: "Turnaround", align: "end", cell: (row) => row.turnaround },
];

export function TableDemo() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [view, setView] = useState("data");

  const rows = useMemo(
    () =>
      sampleOrders.data.filter(
        (row) =>
          (!status || row.status === status) &&
          (!query || `${row.id} ${row.test} ${row.patient}`.toLowerCase().includes(query.toLowerCase())),
      ),
    [query, status],
  );

  const applied = [
    ...(query ? [{ id: "query", label: `Search: ${query}` }] : []),
    ...(status ? [{ id: "status", label: `Status: ${status.replace("_", " ").toLowerCase()}` }] : []),
  ];

  return (
    <div className="space-y-4">
      <SegmentedControl
        legend="Table state"
        value={view}
        onChange={setView}
        options={[
          { value: "data", label: "Data" },
          { value: "loading", label: "Loading" },
          { value: "empty", label: "Empty" },
        ]}
      />
      <FilterBar
        label="Filter laboratory orders"
        search={<SearchInput label="Search orders" placeholder="Search order, test or patient" value={query} onChange={(event) => setQuery(event.target.value)} />}
        filters={
          <SelectField
            label="Status"
            hideLabel
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            options={[
              { value: "", label: "Status: all" },
              { value: "OPEN", label: "Open" },
              { value: "IN_PROGRESS", label: "In progress" },
              { value: "CANCELLED", label: "Cancelled" },
            ]}
          />
        }
        applied={applied}
        onRemove={(id) => (id === "query" ? setQuery("") : setStatus(""))}
        onClearAll={() => {
          setQuery("");
          setStatus("");
        }}
        resultCount={`${rows.length} of ${sampleOrders.data.length} orders`}
      />
      <DataTable
        caption="Laboratory order queue"
        columns={columns}
        rows={view === "empty" ? [] : rows}
        loading={view === "loading"}
        rowKey={(row) => row.id}
        selectedKey="LAB-1042"
        empty={{ title: "No assigned work", description: "New orders assigned to your laboratory will appear here." }}
      />
    </div>
  );
}

export function OverlayDemo() {
  const [dialog, setDialog] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const { toasts, show, dismiss } = useToasts();
  return (
    <div className="flex flex-wrap gap-3">
      <Button variant="secondary" onClick={() => setDialog(true)}>
        Open dialog
      </Button>
      <Button variant="destructive" onClick={() => setConfirm(true)}>
        Suspend selected account
      </Button>
      <Button variant="secondary" onClick={() => setDrawer(true)}>
        Open detail drawer
      </Button>
      <Button variant="tertiary" onClick={() => show("Action recorded")}>
        Show success toast
      </Button>

      <Dialog
        open={dialog}
        onClose={() => setDialog(false)}
        title="Prepare for your visit"
        description="Check your connection and find a private place before the consultation begins."
        footer={<Button onClick={() => setDialog(false)}>Done</Button>}
      >
        <p className="text-data text-text-secondary">Dialogs trap focus, close with Escape and return focus to the trigger.</p>
      </Dialog>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          show("Sample only — no account was changed");
        }}
        tone="destructive"
        title="Suspend this account?"
        description="High-impact actions require confirmation and are recorded in the audit history."
        confirmLabel="Suspend account"
      />
      <Drawer open={drawer} onClose={() => setDrawer(false)} title="Order LAB-1042" footer={<Button onClick={() => setDrawer(false)}>Close</Button>}>
        <DescriptionList
          items={[
            { term: "Requested test", detail: "Complete blood count" },
            { term: "Patient reference", detail: "PT-10482" },
            { term: "Requesting doctor", detail: "Dr. Mariama Cole" },
            { term: "Estimated turnaround", detail: "24 hours" },
          ]}
        />
      </Drawer>
      <ToastRegion toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
