"use client";

import type { ReactNode } from "react";
import { OperationsPageHeading } from "@/features/workspace/record-layout";
import { useAdmin } from "./admin-workspace";

export {
  ListCard,
  NoRecordSelected,
  RecordLayout,
  SelectableList,
  SelectableRow,
  SelectedRecord,
  formatOperationsDateTime as formatAdminDateTime,
  formatOperationsTime as formatAdminTime,
} from "@/features/workspace/record-layout";

/** Operations heading with the role eyebrow ("Super administrator" or "Administrator"). */
export function AdminPageHeading({
  title,
  description,
  action,
}: {
  title: string;
  description: ReactNode;
  action?: ReactNode;
}) {
  const { role } = useAdmin();
  return (
    <OperationsPageHeading
      eyebrow={role === "SUPER_ADMIN" ? "Super administrator" : "Administrator"}
      title={title}
      description={description}
      action={action}
    />
  );
}
