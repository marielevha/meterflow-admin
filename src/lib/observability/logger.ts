import { hostname } from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";

type LogLevel = "info" | "warn" | "error";

type LogPayload = {
  event: string;
  requestId?: string;
  route?: string;
  method?: string;
  status?: number;
  durationMs?: number;
  actorId?: string | null;
  error?: string;
  [key: string]: unknown;
};

const levelOrder: Record<LogLevel, number> = {
  info: 20,
  warn: 30,
  error: 40,
};

const configuredLevel = (process.env.LOG_LEVEL || "info").toLowerCase() as LogLevel;
const minimumLevel: LogLevel = levelOrder[configuredLevel] ? configuredLevel : "info";
const logsDir = process.env.LOG_DIR || "logs";
const maxFileSizeBytes = Math.max(
  1,
  Number(process.env.LOG_MAX_FILE_SIZE_MB || "10") * 1024 * 1024,
);
const maxFiles = Math.max(2, Number(process.env.LOG_MAX_FILES || "10"));
const enableConsole = process.env.LOG_TO_CONSOLE !== "0";

const appLogPath = path.join(logsDir, "application.log");
const errorLogPath = path.join(logsDir, "error.log");
const runningOnEdge = process.env.NEXT_RUNTIME === "edge";

let dirInitialized = false;
let writeQueue: Promise<void> = Promise.resolve();

function getRotatedPath(filePath: string, index: number) {
  const ext = path.extname(filePath);
  const base = filePath.slice(0, filePath.length - ext.length);
  return `${base}.${index}${ext}`;
}

async function safeUnlink(filePath: string) {
  try {
    await fs.unlink(filePath);
  } catch {
    // no-op
  }
}

async function safeRename(from: string, to: string) {
  try {
    await fs.rename(from, to);
  } catch {
    // no-op
  }
}

async function ensureDir() {
  if (dirInitialized || runningOnEdge) return;
  await fs.mkdir(logsDir, { recursive: true });
  dirInitialized = true;
}

async function rotateIfNeeded(filePath: string, incomingBytes: number) {
  try {
    const stat = await fs.stat(filePath);
    if (stat.size + incomingBytes < maxFileSizeBytes) return;
  } catch {
    return;
  }

  await safeUnlink(getRotatedPath(filePath, maxFiles));
  for (let i = maxFiles - 1; i >= 1; i -= 1) {
    await safeRename(getRotatedPath(filePath, i), getRotatedPath(filePath, i + 1));
  }
  await safeRename(filePath, getRotatedPath(filePath, 1));
}

async function appendWithRotation(filePath: string, line: string) {
  const bytes = Buffer.byteLength(line);
  await rotateIfNeeded(filePath, bytes);
  await fs.appendFile(filePath, line, "utf8");
}

function enqueueWrite(task: () => Promise<void>) {
  writeQueue = writeQueue
    .then(task)
    .catch((error) => {
      if (enableConsole) {
        console.error(
          JSON.stringify({
            ts: new Date().toISOString(),
            level: "error",
            event: "logger_internal_failure",
            error: error instanceof Error ? error.message : "unknown_error",
          }),
        );
      }
    });
}

function shouldLog(level: LogLevel) {
  return levelOrder[level] >= levelOrder[minimumLevel];
}

function writeConsole(level: LogLevel, serialized: string) {
  if (!enableConsole) return;
  if (level === "error") {
    console.error(serialized);
    return;
  }
  if (level === "warn") {
    console.warn(serialized);
    return;
  }
  console.log(serialized);
}

function writeLog(level: LogLevel, payload: LogPayload) {
  if (!shouldLog(level)) return;

  const entry = {
    ts: new Date().toISOString(),
    level,
    pid: process.pid,
    host: hostname(),
    ...payload,
  };
  const serialized = JSON.stringify(entry);
  const line = `${serialized}\n`;
  writeConsole(level, serialized);

  if (runningOnEdge) return;
  enqueueWrite(async () => {
    await ensureDir();
    await appendWithRotation(appLogPath, line);
    if (level === "error") {
      await appendWithRotation(errorLogPath, line);
    }
  });
}

export function logInfo(payload: LogPayload) {
  writeLog("info", payload);
}

export function logWarn(payload: LogPayload) {
  writeLog("warn", payload);
}

export function logError(payload: LogPayload) {
  writeLog("error", payload);
}
