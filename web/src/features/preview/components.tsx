"use client";

import { useState } from "react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { FictionalDataBadge } from "@/components/ui/fictional-data-badge";
import { SearchInput } from "@/components/ui/inputs";
import { DescriptionList } from "@/components/ui/lists";
import { MetricCard, MetricGrid, type MetricTone } from "@/components/ui/metric-card";
import { StateMessage } from "@/components/ui/state-message";
import {
  ListCard,
  OperationsPageHeading,
  RecordLayout,
  SelectableList,
  SelectableRow,
  SelectedRecord,
} from "@/features/workspace/record-layout";
import type { PreviewSection } from "./fixtures";
import { PreviewAction } from "./preview-action";

/** Operations heading for a preview; the banner and top bar already carry the Fictional data label. */
export function PreviewHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: string;
}) {
  return (
    <OperationsPageHeading
      eyebrow={eyebrow}
      title={title}
      description={description}
      action={action ? <PreviewAction variant="primary">{action}</PreviewAction> : undefined}
    />
  );
}

export function PreviewMetrics({ metrics }: { metrics: Array<{ value: string; label: string; hint: string; tone: MetricTone }> }) {
  return (
    <MetricGrid>
      {metrics.map((metric) => (
        <MetricCard key={metric.label} value={metric.value} label={metric.label} hint={metric.hint} tone={metric.tone} />
      ))}
    </MetricGrid>
  );
}

/**
 * The reference's generic operations sub-view ("SUBMENU · Active view" list + "SELECTED RECORD"),
 * driven by fictional rows. Selecting a row is local UI state only; actions are PreviewActions.
 */
export function PreviewSubView({ eyebrow, section }: { eyebrow: string; section: PreviewSection }) {
  const [selectedRef, setSelectedRef] = useState(section.rows[0]?.ref);
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const rows = section.rows.filter((row) => !needle || `${row.ref} ${row.title} ${row.meta}`.toLowerCase().includes(needle));
  const selected = section.rows.find((row) => row.ref === selectedRef);
  return (
    <>
      <PreviewHeading eyebrow={eyebrow} title={section.title} description={section.description} />
      <RecordLayout
        list={
          <ListCard eyebrow={`${eyebrow} submenu`} title={section.title} action={<Badge tone="info">Active view</Badge>}>
            <SearchInput label={`Search ${section.title.toLowerCase()}`} placeholder="Search fictional records" value={query} onChange={(event) => setQuery(event.target.value)} />
            {rows.length ? (
              <SelectableList label={`${section.title} (fictional)`}>
                {rows.map((row) => (
                  <SelectableRow
                    key={row.ref}
                    selected={row.ref === selectedRef}
                    onSelect={() => setSelectedRef(row.ref)}
                    marker={row.marker}
                    title={row.title}
                    meta={row.meta}
                    trailing={<StatusBadge status={row.status} tone={row.tone} />}
                  />
                ))}
              </SelectableList>
            ) : (
              <StateMessage kind="empty" layout="inline" title="No fictional records match." />
            )}
          </ListCard>
        }
        record={
          selected ? (
            <SelectedRecord
              focusKey={selected.ref}
              reference={selected.ref}
              title={<StatusBadge status={selected.status} tone={selected.tone} />}
              actions={section.actions.map((action, index) => (
                <PreviewAction key={action} variant={index === 0 ? "primary" : "secondary"} size="sm">
                  {action}
                </PreviewAction>
              ))}
              restricted={section.restricted}
            >
              <DescriptionList items={[{ term: "Current section", detail: section.title }, ...selected.details]} />
            </SelectedRecord>
          ) : null
        }
      />
    </>
  );
}

export function StatusBadge({ status, tone }: { status: string; tone: BadgeTone }) {
  return (
    <Badge tone={tone} className="whitespace-nowrap">
      {status}
    </Badge>
  );
}

/** Presentation-only pricing and payouts block shared by partner previews. */
export function PayoutsCard({ title, items }: { title: string; items: Array<{ label: string; value: string; note: string }> }) {
  return (
    <Card>
      <CardHeader eyebrow="Provider finance" title={title} action={<FictionalDataBadge />} />
      <dl className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="rounded-sm border border-border p-4">
            <dt className="text-caption text-text-muted">{item.label}</dt>
            <dd className="mt-0.5 text-[1.0625rem] font-bold text-green-950">{item.value}</dd>
            <dd className="text-caption text-text-secondary">{item.note}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 rounded-sm bg-warning-soft p-4 text-caption text-ink">
        <strong className="text-warning">Financial boundary.</strong> MedNet takes no payments and makes no payouts. Amounts are
        examples from the design.
      </div>
    </Card>
  );
}
