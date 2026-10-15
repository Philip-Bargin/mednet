import type { Metadata } from "next";
import { TasksView } from "@/features/admin/views";

export const metadata: Metadata = { title: "Task queue" };

export default function Page() {
  return <TasksView />;
}
