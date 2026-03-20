import { NextResponse } from "next/server";

import { getCurrentMobileClient } from "@/lib/auth/mobileSession";
import { getAppSettings } from "@/lib/settings/serverSettings";

export async function GET(request: Request) {
  const auth = await getCurrentMobileClient(request);
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const settings = await getAppSettings();

  return NextResponse.json(
    {
      config: {
        requireGpsForReading: settings.requireGpsForReading,
        maxGpsDistanceMeters: settings.maxGpsDistanceMeters,
        maxImageSizeMb: settings.maxImageSizeMb,
      },
    },
    { status: 200 }
  );
}
