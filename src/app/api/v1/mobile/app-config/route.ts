import { NextResponse } from "next/server";

import { getCurrentMobileClient } from "@/lib/auth/mobileSession";
import { buildClientReadingSubmissionWindow } from "@/lib/mobile/readingSubmissionWindow";
import { getAppSettings } from "@/lib/settings/serverSettings";

export async function GET(request: Request) {
  const auth = await getCurrentMobileClient(request);
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const settings = await getAppSettings();
  const readingSubmissionWindow = buildClientReadingSubmissionWindow(settings);

  return NextResponse.json(
    {
      config: {
        requireGpsForReading: settings.requireGpsForReading,
        maxGpsDistanceMeters: settings.maxGpsDistanceMeters,
        maxImageSizeMb: settings.maxImageSizeMb,
        readingSubmissionWindow: {
          isOpen: readingSubmissionWindow.isOpen,
          windowStart: readingSubmissionWindow.windowStart.toISOString(),
          windowEnd: readingSubmissionWindow.windowEnd.toISOString(),
          timeZone: readingSubmissionWindow.timeZone,
          startDay: readingSubmissionWindow.startDay,
          endDay: readingSubmissionWindow.endDay,
        },
      },
    },
    { status: 200 }
  );
}
