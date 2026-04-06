import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

import { getCurrentMobileClient } from "@/lib/auth/mobileSession";
import { uploadObjectFile } from "@/lib/storage/s3";

export const runtime = "nodejs";

const ALLOWED_PURPOSES = new Set(["reading_photo"]);
const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_SIZE_BYTES = 15 * 1024 * 1024;

export async function POST(request: Request) {
  const auth = await getCurrentMobileClient(request);
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  try {
    const formData = (await request.formData()) as unknown as {
      get(name: string): FormDataEntryValue | null;
    };
    const purposeValue = formData.get("purpose");
    const fileValue = formData.get("file");
    const purpose =
      typeof purposeValue === "string" && purposeValue.trim() ? purposeValue.trim() : "reading_photo";

    if (!ALLOWED_PURPOSES.has(purpose)) {
      return NextResponse.json({ error: "invalid_upload_purpose" }, { status: 400 });
    }

    if (!(fileValue instanceof File)) {
      return NextResponse.json({ error: "file_required" }, { status: 400 });
    }

    const fileName = fileValue.name?.trim() || `upload-${Date.now()}.bin`;
    const mimeType = fileValue.type?.trim() || "application/octet-stream";
    const sizeBytes = fileValue.size;

    if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
      return NextResponse.json({ error: "invalid_file_type" }, { status: 400 });
    }

    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: "invalid_file_size" }, { status: 400 });
    }

    const bytes = Buffer.from(await fileValue.arrayBuffer());
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const uploaded = await uploadObjectFile({
      userId: auth.user.id,
      fileName,
      mimeType,
      sha256,
      purpose,
      body: bytes,
      requestUrl: request.url,
    });

    return NextResponse.json(
      {
        message: "upload_completed",
        file: {
          key: uploaded.key,
          url: uploaded.fileUrl,
          sha256,
          mimeType,
          sizeBytes,
          purpose,
          fileName,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "upload_failed",
        detail: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 400 }
    );
  }
}
