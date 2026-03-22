import fs from "node:fs/promises";
import path from "node:path";

const ALLOWED_PREFIX = "/seed/demo-assets/";

function toPathname(fileUrl: string) {
  if (fileUrl.startsWith("/")) return fileUrl;

  try {
    const parsed = new URL(fileUrl);
    return parsed.pathname;
  } catch {
    return null;
  }
}

function contentTypeFor(filePath: string) {
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
  if (filePath.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

export async function getLocalDemoAsset(fileUrl: string) {
  const pathname = toPathname(fileUrl);
  if (!pathname || !pathname.startsWith(ALLOWED_PREFIX)) {
    return null;
  }

  const relativePath = pathname.replace(/^\/+/, "");
  const absolutePath = path.join(process.cwd(), "public", relativePath);
  const normalizedPublicRoot = path.join(process.cwd(), "public") + path.sep;
  const normalizedAbsolutePath = path.normalize(absolutePath);

  if (!normalizedAbsolutePath.startsWith(normalizedPublicRoot)) {
    return null;
  }

  try {
    const body = await fs.readFile(normalizedAbsolutePath);
    return {
      body,
      contentType: contentTypeFor(normalizedAbsolutePath),
    };
  } catch {
    return null;
  }
}
