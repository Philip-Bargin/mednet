import type { Metadata } from "next";
import { UsersAndRolesView } from "@/features/admin/views";

export const metadata: Metadata = { title: "Users and roles" };

export default async function Page({ searchParams }: PageProps<"/admin/users">) {
  const { type, status } = await searchParams;
  return (
    <UsersAndRolesView
      type={typeof type === "string" ? type : undefined}
      status={typeof status === "string" ? status : undefined}
    />
  );
}
