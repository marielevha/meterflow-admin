import { prisma } from '@/lib/prisma';

const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 24;

export function normalizeUsernameValue(value?: string | null) {
  return value?.trim().toLowerCase() ?? '';
}

export function usernameLengthRange() {
  return { min: USERNAME_MIN_LENGTH, max: USERNAME_MAX_LENGTH };
}

export function sanitizeUsernameFromNames(firstName?: string | null, lastName?: string | null) {
  const parts = [firstName, lastName]
    .map((part) => slugifyUsernamePart(part ?? ''))
    .filter(Boolean);

  const joined = parts.join('.');
  return clampUsername(joined);
}

export function validateUsernameCandidate(value?: string | null) {
  const normalized = normalizeUsernameValue(value);

  if (!normalized) {
    return { ok: false as const, normalized, error: 'username_required' as const };
  }

  if (normalized.length < USERNAME_MIN_LENGTH || normalized.length > USERNAME_MAX_LENGTH) {
    return { ok: false as const, normalized, error: 'invalid_username_length' as const };
  }

  if (!/^[a-z][a-z0-9._]*$/.test(normalized)) {
    return { ok: false as const, normalized, error: 'invalid_username_format' as const };
  }

  if (/[._]{2,}/.test(normalized) || /[._]$/.test(normalized)) {
    return { ok: false as const, normalized, error: 'invalid_username_format' as const };
  }

  return { ok: true as const, normalized };
}

export async function isUsernameAvailable(username: string, options: { excludeUserId?: string } = {}) {
  const existing = await prisma.user.findFirst({
    where: {
      deletedAt: null,
      username,
      ...(options.excludeUserId ? { id: { not: options.excludeUserId } } : {}),
    },
    select: { id: true },
  });

  return !existing;
}

export async function generateAvailableUsernameFromNames(
  firstName?: string | null,
  lastName?: string | null
) {
  const candidates = buildUsernameCandidatesFromNames(firstName, lastName);
  const base = candidates[0] ?? '';

  if (!base) {
    return { ok: false as const, error: 'name_seed_required' as const };
  }

  const username = await generateAvailableUsernameFromCandidates(candidates);
  return { ok: true as const, username, base };
}

export async function checkUsernameAvailability(value?: string | null) {
  const validation = validateUsernameCandidate(value);

  if (!validation.ok) {
    return {
      ok: false as const,
      normalized: validation.normalized,
      error: validation.error,
    };
  }

  const available = await isUsernameAvailable(validation.normalized);

  if (available) {
    return {
      ok: true as const,
      normalized: validation.normalized,
      available: true,
    };
  }

  const suggestion = await generateAvailableUsername(validation.normalized);

  return {
    ok: false as const,
    normalized: validation.normalized,
    available: false,
    error: 'username_already_exists' as const,
    suggestion,
  };
}

async function generateAvailableUsername(base: string) {
  const candidates = buildBaseUsernameVariants(base);
  return generateAvailableUsernameFromCandidates(candidates);
}

async function generateAvailableUsernameFromCandidates(candidates: string[]) {
  const normalizedCandidates = uniqueUsernames(candidates);

  if (normalizedCandidates.length === 0) {
    return '';
  }

  const existingUsernames = await prisma.user.findMany({
    where: {
      deletedAt: null,
      username: { in: normalizedCandidates },
    },
    select: { username: true },
  });

  const taken = new Set(existingUsernames.map((entry) => entry.username).filter(Boolean));
  const directMatch = normalizedCandidates.find((candidate) => !taken.has(candidate));

  if (directMatch) {
    return directMatch;
  }

  const suffixBases = normalizedCandidates.slice(0, 6);

  for (const base of suffixBases) {
    for (let attempt = 2; attempt <= 99; attempt += 1) {
      const candidate = withNumericSuffix(base, attempt);
      if (await isUsernameAvailable(candidate)) {
        return candidate;
      }
    }
  }

  return withNumericSuffix(normalizedCandidates[0], Date.now() % 1000);
}

function slugifyUsernamePart(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/[._]{2,}/g, '.')
    .replace(/^[._]+|[._]+$/g, '');
}

function clampUsername(value: string) {
  const trimmed = value
    .replace(/[._]{2,}/g, '.')
    .replace(/^[._]+|[._]+$/g, '');

  return trimmed.slice(0, USERNAME_MAX_LENGTH).replace(/[._]+$/g, '');
}

function withNumericSuffix(base: string, suffixNumber: number) {
  const suffix = String(suffixNumber);
  const baseSlice = base.slice(0, Math.max(USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH - suffix.length));
  return `${baseSlice}${suffix}`;
}

function buildUsernameCandidatesFromNames(firstName?: string | null, lastName?: string | null) {
  const firstTokens = tokenizeNamePart(firstName);
  const lastTokens = tokenizeNamePart(lastName);

  const firstPrimary = firstTokens[0] ?? '';
  const lastPrimary = lastTokens[lastTokens.length - 1] ?? '';
  const firstCompact = firstTokens.join('');
  const lastCompact = lastTokens.join('');
  const firstInitial = firstPrimary[0] ?? '';
  const lastInitial = lastPrimary[0] ?? '';

  return uniqueUsernamesByShortest([
    `${firstInitial}${lastPrimary}`,
    `${firstPrimary}${lastInitial}`,
    `${lastPrimary}${firstInitial}`,
    `${firstInitial}.${lastPrimary}`,
    `${firstPrimary}.${lastInitial}`,
    `${lastPrimary}.${firstInitial}`,
    `${firstCompact}${lastInitial}`,
    `${firstInitial}${lastCompact}`,
    `${firstPrimary}${lastPrimary}`,
    `${lastPrimary}${firstPrimary}`,
    `${firstPrimary}.${lastPrimary}`,
    `${firstPrimary}_${lastPrimary}`,
    `${firstCompact}${lastCompact}`,
    `${firstCompact}.${lastCompact}`,
    `${firstCompact}${lastPrimary}`,
    sanitizeUsernameFromNames(firstName, lastName),
  ]);
}

function buildBaseUsernameVariants(base: string) {
  const normalized = clampUsername(normalizeUsernameValue(base));

  if (!normalized) {
    return [];
  }

  const compact = clampUsername(normalized.replace(/[._]+/g, ''));
  const dotted = clampUsername(normalized.replace(/[_]+/g, '.'));
  const underscored = clampUsername(normalized.replace(/[.]+/g, '_'));

  return uniqueUsernames([normalized, compact, dotted, underscored]);
}

function tokenizeNamePart(value?: string | null) {
  const slugified = slugifyUsernamePart(value ?? '');
  return slugified.split('.').filter(Boolean);
}

function uniqueUsernames(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const candidate = clampUsername(normalizeUsernameValue(value));
    if (
      !candidate ||
      candidate.length < USERNAME_MIN_LENGTH ||
      seen.has(candidate)
    ) {
      continue;
    }

    seen.add(candidate);
    result.push(candidate);
  }

  return result;
}

function uniqueUsernamesByShortest(values: string[]) {
  return uniqueUsernames(values).sort((left, right) => {
    if (left.length !== right.length) {
      return left.length - right.length;
    }

    return left.localeCompare(right);
  });
}
