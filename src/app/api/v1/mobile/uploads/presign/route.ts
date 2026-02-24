import { NextResponse } from "next/server";
import { getCurrentMobileClient } from "@/lib/auth/mobileSession";
import { createUploadToken } from "@/lib/storage/uploadToken";
import { createPresignedPutUrl } from "@/lib/storage/s3";

const ALLOWED_PURPOSES = new Set(["reading_photo"]);
const MAX_SIZE_BYTES = 15 * 1024 * 1024;

export async function POST(request: Request) {
  const auth = await getCurrentMobileClient(request);
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  try {
    const payload = await request.json();
    const fileName = typeof payload?.fileName === "string" ? payload.fileName.trim() : "";
    const mimeType = typeof payload?.mimeType === "string" ? payload.mimeType.trim() : "";
    const sha256 = typeof payload?.sha256 === "string" ? payload.sha256.trim().toLowerCase() : "";
    const purpose = typeof payload?.purpose === "string" ? payload.purpose.trim() : "reading_photo";
    const sizeBytes = Number(payload?.sizeBytes);

    if (!fileName || !mimeType || !sha256 || !Number.isFinite(sizeBytes)) {
      return NextResponse.json(
        { error: "file_name_mime_type_sha256_size_bytes_required" },
        { status: 400 }
      );
    }

    if (!ALLOWED_PURPOSES.has(purpose)) {
      return NextResponse.json({ error: "invalid_upload_purpose" }, { status: 400 });
    }

    if (sizeBytes <= 0 || sizeBytes > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: "invalid_file_size" }, { status: 400 });
    }

    if (!/^[a-f0-9]{64}$/i.test(sha256)) {
      return NextResponse.json({ error: "invalid_sha256_format" }, { status: 400 });
    }

    const expiresInSeconds = 900;
    const presigned = await createPresignedPutUrl({
      userId: auth.user.id,
      fileName,
      mimeType,
      sha256,
      expiresInSeconds,
      purpose,
    });

    const uploadToken = createUploadToken(
      {
        userId: auth.user.id,
        key: presigned.key,
        mimeType,
        sizeBytes: Math.floor(sizeBytes),
        sha256,
        purpose,
      },
      expiresInSeconds
    );

    return NextResponse.json(
      {
        uploadUrl: presigned.uploadUrl,
        method: "PUT",
        requiredHeaders: presigned.requiredHeaders,
        objectKey: presigned.key,
        fileUrl: presigned.fileUrl,
        expiresInSeconds,
        uploadToken,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "presign_failed",
        detail: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 400 }
    );
  }
}
