"use server";

import { getCurrentStaffFromServerComponent } from "@/lib/auth/staffServerSession";

export async function getCurrentStaffFromServerAction() {
  return getCurrentStaffFromServerComponent();
}
