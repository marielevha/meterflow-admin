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
    anyOfPermissions: ["task:update", "task:assign", "audit:view"],
  });
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "task_id_required" }, { status: 400 });
  }

  const task = await prisma.task.findFirst({
    where: {
      id,
      deletedAt: null,
    },
    select: {
      fieldImageUrl: true,
    },
  });

  if (!task) {
    return NextResponse.json({ error: "task_not_found" }, { status: 404 });
  }

  if (!task.fieldImageUrl) {
    return NextResponse.json({ error: "task_field_image_not_found" }, { status: 404 });
  }

  const objectKey = extractObjectKeyFromUrl(task.fieldImageUrl);
  if (!objectKey) {
    const localAsset = await getLocalDemoAsset(task.fieldImageUrl);
    if (!localAsset) {
      return NextResponse.json({ error: "task_field_image_key_invalid" }, { status: 400 });
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
      return NextResponse.json({ error: "task_field_image_not_found" }, { status: 404 });
    }

    return new NextResponse(Buffer.from(file.body), {
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
    return NextResponse.json({ error: "task_field_image_fetch_failed" }, { status: 502 });
  }
}
