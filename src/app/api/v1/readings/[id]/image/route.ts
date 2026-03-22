import { NextResponse } from "next/server";

import { getCurrentStaffUser } from "@/lib/auth/staffSession";
import { prisma } from "@/lib/prisma";
import { getLocalDemoAsset } from "@/lib/storage/localDemoAsset";
import { extractObjectKeyFromUrl, getObjectFile } from "@/lib/storage/s3";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await getCurrentStaffUser(request, {
    anyOfPermissions: ["reading:view", "reading:review", "audit:view"],
  });
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "reading_id_required" }, { status: 400 });
  }

  const reading = await prisma.reading.findFirst({
    where: {
      id,
      deletedAt: null,
    },
    select: {
      imageUrl: true,
    },
  });

  if (!reading) {
    return NextResponse.json({ error: "reading_not_found" }, { status: 404 });
  }

  if (!reading.imageUrl) {
    return NextResponse.json({ error: "reading_image_not_found" }, { status: 404 });
  }

  const objectKey = extractObjectKeyFromUrl(reading.imageUrl);
  if (!objectKey) {
    const localAsset = await getLocalDemoAsset(reading.imageUrl);
    if (!localAsset) {
      return NextResponse.json({ error: "reading_image_key_invalid" }, { status: 400 });
    }

    return new NextResponse(localAsset.body, {
      status: 200,
      headers: {
        "Content-Type": localAsset.contentType,
        "Content-Length": String(localAsset.body.byteLength),
        "Cache-Control": "private, max-age=300",
      },
    });
  }

  try {
    const file = await getObjectFile({ key: objectKey });

    if (!file.body) {
      return NextResponse.json({ error: "reading_image_not_found" }, { status: 404 });
    }

    const fileBody = file.body;
    const responseBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(fileBody);
        controller.close();
      },
    });

    return new NextResponse(responseBody, {
      status: 200,
      headers: {
        "Content-Type": file.contentType,
        ...(file.contentLength ? { "Content-Length": String(file.contentLength) } : {}),
        ...(file.etag ? { ETag: file.etag } : {}),
        ...(file.lastModified ? { "Last-Modified": file.lastModified } : {}),
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return NextResponse.json({ error: "reading_image_fetch_failed" }, { status: 502 });
  }
}
