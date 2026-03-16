import { randomUUID } from "node:crypto";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { URL } from "node:url";

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

function isLocalHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function resolvePublicEndpoint(requestUrl?: string) {
  const explicitPublicEndpoint =
    process.env.S3_PUBLIC_ENDPOINT || process.env.STORAGE_PUBLIC_BASE_URL || "";

  if (explicitPublicEndpoint) {
    return explicitPublicEndpoint.replace(/\/$/, "");
  }

  const endpoint = requiredEnv("S3_ENDPOINT").replace(/\/$/, "");

  if (!requestUrl) {
    return endpoint;
  }

  try {
    const endpointUrl = new URL(endpoint);
    if (!isLocalHostname(endpointUrl.hostname)) {
      return endpoint;
    }

    const incomingUrl = new URL(requestUrl);
    endpointUrl.hostname = incomingUrl.hostname;
    return endpointUrl.toString().replace(/\/$/, "");
  } catch {
    return endpoint;
  }
}

function createS3Client(endpointOverride?: string) {
  return new S3Client({
    region: requiredEnv("S3_REGION"),
    endpoint: endpointOverride || requiredEnv("S3_ENDPOINT"),
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

export function extractObjectKeyFromUrl(fileUrl: string) {
  try {
    const parsed = new URL(fileUrl);
    const bucket = requiredEnv("S3_BUCKET");
    const expectedPrefix = `/${bucket}/`;

    if (!parsed.pathname.startsWith(expectedPrefix)) {
      return null;
    }

    return decodeURIComponent(parsed.pathname.slice(expectedPrefix.length));
  } catch {
    return null;
  }
}

export function buildObjectUrl(key: string, requestUrl?: string) {
  const endpoint = resolvePublicEndpoint(requestUrl);
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
  requestUrl?: string;
}) {
  const bucket = requiredEnv("S3_BUCKET");
  const key = createObjectKey(params.userId, params.purpose, params.fileName);
  const publicEndpoint = resolvePublicEndpoint(params.requestUrl);
  const s3 = createS3Client(publicEndpoint);

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
  const fileUrl = buildObjectUrl(key, params.requestUrl);

  return {
    bucket,
    key,
    uploadUrl,
    fileUrl,
    requiredHeaders: {},
  };
}

export async function getObjectFile(params: { key: string }) {
  const bucket = requiredEnv("S3_BUCKET");
  const s3 = createS3Client();

  const response = await s3.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: params.key,
    })
  );

  const body = response.Body ? await response.Body.transformToByteArray() : null;

  return {
    body,
    contentType: response.ContentType || "application/octet-stream",
    contentLength: response.ContentLength || undefined,
    etag: response.ETag || undefined,
    lastModified: response.LastModified?.toUTCString(),
  };
}
