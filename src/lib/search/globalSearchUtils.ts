export type SearchQueryProfile = {
  rawQuery: string;
  normalizedQuery: string;
  tokens: string[];
  compactQuery: string;
  digitQuery: string;
  exactUuid: string | null;
  uuidPrefix: string | null;
};

export type WeightedSearchField = {
  value: string | null | undefined;
  weight: number;
};

function trimAndCollapseSpaces(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function stripDiacritics(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeForSearch(value: string | null | undefined) {
  if (!value) return "";
  return trimAndCollapseSpaces(
    stripDiacritics(value)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
  );
}

export function compactForSearch(value: string | null | undefined) {
  return stripDiacritics(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

export function digitsOnlyForSearch(value: string | null | undefined) {
  return (value || "").replace(/\D+/g, "");
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
}

export function buildSearchQueryProfile(query: string): SearchQueryProfile {
  const rawQuery = trimAndCollapseSpaces(query);
  const normalizedQuery = normalizeForSearch(rawQuery);
  const compactQuery = compactForSearch(rawQuery);
  const digitQuery = digitsOnlyForSearch(rawQuery);
  const tokens = unique(
    normalizedQuery
      .split(" ")
      .map((token) => token.trim())
      .filter((token) => token.length >= 2)
  );
  const uuidPrefix = /^[0-9a-f-]{6,36}$/i.test(rawQuery) ? rawQuery.toLowerCase() : null;

  return {
    rawQuery,
    normalizedQuery,
    tokens,
    compactQuery,
    digitQuery,
    exactUuid: isUuid(rawQuery) ? rawQuery : null,
    uuidPrefix,
  };
}

function tokenPresenceScore(tokens: string[], normalizedCandidate: string) {
  if (tokens.length === 0 || !normalizedCandidate) return 0;
  const candidateParts = normalizedCandidate.split(" ");
  let total = 0;
  let matchedTokens = 0;

  for (const token of tokens) {
    if (candidateParts.includes(token)) {
      total += 110;
      matchedTokens += 1;
      continue;
    }

    if (candidateParts.some((part) => part.startsWith(token))) {
      total += 90;
      matchedTokens += 1;
      continue;
    }

    if (normalizedCandidate.includes(token)) {
      total += 55;
      matchedTokens += 1;
    }
  }

  if (matchedTokens === tokens.length && matchedTokens > 0) {
    total += 80 + matchedTokens * 10;
  }

  return total;
}

export function scoreSearchValue(profile: SearchQueryProfile, candidate: string | null | undefined) {
  if (!candidate) return 0;

  const normalizedCandidate = normalizeForSearch(candidate);
  const compactCandidate = compactForSearch(candidate);
  const digitCandidate = digitsOnlyForSearch(candidate);
  let score = 0;

  if (!normalizedCandidate && !compactCandidate && !digitCandidate) return score;

  if (profile.normalizedQuery) {
    if (normalizedCandidate === profile.normalizedQuery) {
      score = Math.max(score, 620);
    } else if (normalizedCandidate.startsWith(profile.normalizedQuery)) {
      score = Math.max(score, 470);
    } else if (normalizedCandidate.includes(profile.normalizedQuery)) {
      score = Math.max(score, 260);
    }
  }

  if (profile.compactQuery) {
    if (compactCandidate === profile.compactQuery) {
      score = Math.max(score, 560);
    } else if (compactCandidate.startsWith(profile.compactQuery)) {
      score = Math.max(score, 430);
    } else if (compactCandidate.includes(profile.compactQuery)) {
      score = Math.max(score, 220);
    }
  }

  if (profile.digitQuery.length >= 4) {
    if (digitCandidate === profile.digitQuery) {
      score = Math.max(score, 540);
    } else if (digitCandidate.startsWith(profile.digitQuery)) {
      score = Math.max(score, 400);
    } else if (digitCandidate.includes(profile.digitQuery)) {
      score = Math.max(score, 240);
    }
  }

  score += tokenPresenceScore(profile.tokens, normalizedCandidate);

  if (profile.uuidPrefix && candidate.toLowerCase().startsWith(profile.uuidPrefix)) {
    score = Math.max(score, 500);
  }

  return score;
}

export function rankWeightedFields(profile: SearchQueryProfile, fields: WeightedSearchField[]) {
  return fields.reduce((total, field) => total + scoreSearchValue(profile, field.value) * field.weight, 0);
}

export type HighlightPart = {
  text: string;
  match: boolean;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildHighlightParts(value: string, query: string): HighlightPart[] {
  if (!value) return [{ text: "", match: false }];

  const tokens = unique(
    query
      .split(/[^\p{L}\p{N}]+/gu)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2)
      .sort((left, right) => right.length - left.length)
  );

  if (tokens.length === 0) {
    return [{ text: value, match: false }];
  }

  const matcher = new RegExp(`(${tokens.map(escapeRegExp).join("|")})`, "gi");
  const parts = value.split(matcher).filter(Boolean);

  return parts.map((part) => ({
    text: part,
    match: tokens.some((token) => token.toLowerCase() === part.toLowerCase()),
  }));
}
