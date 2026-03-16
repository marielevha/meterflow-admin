import { NextResponse } from "next/server";
import { getCurrentMobileClient } from "@/lib/auth/mobileSession";
import { verifyUploadToken } from "@/lib/storage/uploadToken";
import { buildObjectUrl } from "@/lib/storage/s3";

export async function POST(request: Request) {
  const auth = await getCurrentMobileClient(request);
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  try {
    const payload = await request.json();
    const uploadToken =
      typeof payload?.uploadToken === "string" ? payload.uploadToken.trim() : "";
    const sha256 = typeof payload?.sha256 === "string" ? payload.sha256.trim().toLowerCase() : "";
    const mimeType = typeof payload?.mimeType === "string" ? payload.mimeType.trim() : "";
    const sizeBytes = Number(payload?.sizeBytes);

    if (!uploadToken || !sha256 || !mimeType || !Number.isFinite(sizeBytes)) {
      return NextResponse.json(
        { error: "upload_token_sha256_mime_type_size_bytes_required" },
        { status: 400 }
      );
    }

    const tokenPayload = verifyUploadToken(uploadToken);
    if (!tokenPayload) {
      return NextResponse.json({ error: "invalid_or_expired_upload_token" }, { status: 401 });
    }

    if (tokenPayload.userId !== auth.user.id) {
      return NextResponse.json({ error: "upload_token_user_mismatch" }, { status: 403 });
    }

    if (tokenPayload.sha256 !== sha256) {
      return NextResponse.json({ error: "hash_mismatch" }, { status: 400 });
    }

    if (tokenPayload.mimeType !== mimeType) {
      return NextResponse.json({ error: "mime_type_mismatch" }, { status: 400 });
    }

    if (tokenPayload.sizeBytes !== Math.floor(sizeBytes)) {
      return NextResponse.json({ error: "size_mismatch" }, { status: 400 });
    }

    return NextResponse.json(
      {
        message: "upload_validated",
        file: {
          key: tokenPayload.key,
          url: buildObjectUrl(tokenPayload.key, request.url),
          sha256: tokenPayload.sha256,
          mimeType: tokenPayload.mimeType,
          sizeBytes: tokenPayload.sizeBytes,
          purpose: tokenPayload.purpose,
        },
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
}
