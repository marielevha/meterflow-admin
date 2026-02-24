import { randomUUID } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

function toBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback;
  return value.toLowerCase() === "true";
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function guessExtension(fileName: string) {
  const normalized = sanitizeFileName(fileName);
  const index = normalized.lastIndexOf(".");
  if (index <= 0 || index === normalized.length - 1) return "bin";
  return normalized.slice(index + 1).toLowerCase();
}

function createS3Client() {
  return new S3Client({
    region: requiredEnv("S3_REGION"),
    endpoint: requiredEnv("S3_ENDPOINT"),
    forcePathStyle: toBoolean(process.env.S3_FORCE_PATH_STYLE, true),
    credentials: {
      accessKeyId: requiredEnv("S3_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnv("S3_SECRET_ACCESS_KEY"),
    },
  });
}

function createObjectKey(userId: string, purpose: string, fileName: string) {
  const ext = guessExtension(fileName);
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `mobile/${purpose}/${userId}/${yyyy}/${mm}/${randomUUID()}.${ext}`;
}

export function buildObjectUrl(key: string) {
  const publicBase = process.env.STORAGE_PUBLIC_BASE_URL;
  if (publicBase) {
    return `${publicBase.replace(/\/$/, "")}/${key}`;
  }

  const endpoint = requiredEnv("S3_ENDPOINT").replace(/\/$/, "");
  const bucket = requiredEnv("S3_BUCKET");
  return `${endpoint}/${bucket}/${key}`;
}

export async function createPresignedPutUrl(params: {
  userId: string;
  fileName: string;
  mimeType: string;
  sha256: string;
  expiresInSeconds: number;
  purpose: string;
}) {
  const bucket = requiredEnv("S3_BUCKET");
  const key = createObjectKey(params.userId, params.purpose, params.fileName);
  const s3 = createS3Client();

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: params.mimeType,
    Metadata: {
      sha256: params.sha256,
      uploaded_by: params.userId,
      purpose: params.purpose,
    },
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: params.expiresInSeconds });
  const fileUrl = buildObjectUrl(key);

  return {
    bucket,
    key,
    uploadUrl,
    fileUrl,
    requiredHeaders: {
      "Content-Type": params.mimeType,
      "x-amz-meta-sha256": params.sha256,
      "x-amz-meta-uploaded_by": params.userId,
      "x-amz-meta-purpose": params.purpose,
    },
  };
}
