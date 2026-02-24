import React from "react";
import { redirect } from "next/navigation";
import AdminShell from "@/layout/AdminShell";
import { getCurrentStaffFromServerComponent } from "@/lib/auth/staffServerSession";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await getCurrentStaffFromServerComponent();
  if (!staff) {
    redirect("/signin");
  }

  return <AdminShell>{children}</AdminShell>;
}

