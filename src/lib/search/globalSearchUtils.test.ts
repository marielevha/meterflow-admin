import test from "node:test";
import assert from "node:assert/strict";
import {
  buildHighlightParts,
  buildSearchQueryProfile,
  normalizeForSearch,
  rankWeightedFields,
  scoreSearchValue,
} from "./globalSearchUtils";

test("normalizeForSearch strips accents and punctuation", () => {
  assert.equal(normalizeForSearch("Frédy-Mampouya"), "fredy mampouya");
  assert.equal(normalizeForSearch("MF-CG-BZV-0006"), "mf cg bzv 0006");
});

test("buildSearchQueryProfile tokenizes names and codes", () => {
  const profile = buildSearchQueryProfile("Freddy Mampouya");
  assert.deepEqual(profile.tokens, ["freddy", "mampouya"]);
  assert.equal(profile.compactQuery, "freddymampouya");

  const codeProfile = buildSearchQueryProfile("MF-CG-BZV-0006");
  assert.deepEqual(codeProfile.tokens, ["mf", "cg", "bzv", "0006"]);
  assert.equal(codeProfile.compactQuery, "mfcgbzv0006");
});

test("buildSearchQueryProfile detects exact UUID and UUID prefix", () => {
  const exact = buildSearchQueryProfile("1068a6e6-cc07-4361-b2b7-061f658555b0");
  assert.equal(exact.exactUuid, "1068a6e6-cc07-4361-b2b7-061f658555b0");
  assert.equal(exact.uuidPrefix, "1068a6e6-cc07-4361-b2b7-061f658555b0");

  const prefix = buildSearchQueryProfile("1068a6e6");
  assert.equal(prefix.exactUuid, null);
  assert.equal(prefix.uuidPrefix, "1068a6e6");
});

test("scoreSearchValue favors exact matches over loose contains", () => {
  const profile = buildSearchQueryProfile("freddy");
  const exactScore = scoreSearchValue(profile, "Freddy");
  const containsScore = scoreSearchValue(profile, "Compte de Freddy Mampouya");

  assert.ok(exactScore > containsScore);
});

test("rankWeightedFields favors direct user name over indirect meter relation", () => {
  const profile = buildSearchQueryProfile("Freddy Mampouya");

  const userScore = rankWeightedFields(profile, [
    { value: "Freddy Mampouya", weight: 3.2 },
    { value: "client006", weight: 2 },
  ]);
  const meterScore = rankWeightedFields(profile, [
    { value: "MF-CG-BZV-0006", weight: 3.1 },
    { value: "CG-BZV-0006", weight: 2.8 },
    { value: "Freddy Mampouya", weight: 0.9 },
  ]);

  assert.ok(userScore > meterScore);
});

test("buildHighlightParts marks query tokens inside result labels", () => {
  const parts = buildHighlightParts("Freddy Mampouya", "freddy mamp");

  assert.deepEqual(parts, [
    { text: "Freddy", match: true },
    { text: " ", match: false },
    { text: "Mamp", match: true },
    { text: "ouya", match: false },
  ]);
});
