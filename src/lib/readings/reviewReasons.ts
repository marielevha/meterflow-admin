export type ReadingReviewReasonCode =
  | "BLURRY_IMAGE"
  | "INDEX_NOT_READABLE"
  | "METER_NOT_VISIBLE"
  | "WRONG_METER"
  | "GPS_MISMATCH"
  | "INDEX_INCONSISTENT"
  | "INVALID_INDEX_VALUE"
  | "SUSPECTED_TAMPERING"
  | "DUPLICATE_SUBMISSION"
  | "OTHER_QUALITY_ISSUE";

type ReadingReviewReasonMeta = {
  code: ReadingReviewReasonCode;
  label: string;
  clientMessage: string;
};

const LEGACY_REASON_ALIASES: Record<string, ReadingReviewReasonCode> = {
  gps_distance_exceeded: "GPS_MISMATCH",
  gps_distance: "GPS_MISMATCH",
  primary_index_monotonic: "INDEX_INCONSISTENT",
  secondary_index_monotonic: "INDEX_INCONSISTENT",
};

export const FLAG_REASON_OPTIONS: ReadingReviewReasonMeta[] = [
  {
    code: "BLURRY_IMAGE",
    label: "Photo floue",
    clientMessage: "La photo paraît floue. Un contrôle complémentaire est nécessaire avant validation.",
  },
  {
    code: "GPS_MISMATCH",
    label: "Position GPS incohérente",
    clientMessage: "La position de prise de vue semble éloignée du compteur enregistré.",
  },
  {
    code: "INDEX_INCONSISTENT",
    label: "Index incohérent",
    clientMessage: "L'index transmis paraît incohérent avec l'historique du compteur.",
  },
  {
    code: "SUSPECTED_TAMPERING",
    label: "Suspicion de fraude ou altération",
    clientMessage: "Le relevé nécessite un contrôle manuel pour vérifier l'intégrité du compteur.",
  },
  {
    code: "OTHER_QUALITY_ISSUE",
    label: "Contrôle complémentaire requis",
    clientMessage: "Le relevé nécessite une vérification complémentaire par un agent.",
  },
];

export const REJECTION_REASON_OPTIONS: ReadingReviewReasonMeta[] = [
  {
    code: "BLURRY_IMAGE",
    label: "Photo floue",
    clientMessage: "La photo est trop floue pour permettre la validation. Merci de reprendre le relevé.",
  },
  {
    code: "INDEX_NOT_READABLE",
    label: "Index illisible",
    clientMessage: "L'index du compteur est illisible. Merci de reprendre une photo plus nette.",
  },
  {
    code: "METER_NOT_VISIBLE",
    label: "Compteur non visible",
    clientMessage: "Le compteur n'est pas clairement visible sur la photo. Merci de refaire le relevé.",
  },
  {
    code: "WRONG_METER",
    label: "Mauvais compteur photographié",
    clientMessage: "Le compteur photographié ne correspond pas au compteur attendu pour ce compte.",
  },
  {
    code: "INVALID_INDEX_VALUE",
    label: "Valeur d'index invalide",
    clientMessage: "La valeur d'index transmise est invalide ou incohérente. Merci de vérifier avant renvoi.",
  },
  {
    code: "DUPLICATE_SUBMISSION",
    label: "Soumission en doublon",
    clientMessage: "Ce relevé semble être un doublon et n'a pas été retenu.",
  },
  {
    code: "OTHER_QUALITY_ISSUE",
    label: "Preuve insuffisante",
    clientMessage: "Le relevé ne peut pas être validé dans son état actuel. Merci de le refaire.",
  },
];

const REASON_META_BY_CODE = new Map<ReadingReviewReasonCode, ReadingReviewReasonMeta>(
  [...FLAG_REASON_OPTIONS, ...REJECTION_REASON_OPTIONS].map((reason) => [reason.code, reason])
);

export function canonicalizeReviewReasonCode(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (REASON_META_BY_CODE.has(trimmed as ReadingReviewReasonCode)) {
    return trimmed as ReadingReviewReasonCode;
  }
  return LEGACY_REASON_ALIASES[trimmed.toLowerCase()] ?? trimmed;
}

export function normalizeFlagReasonCode(value: unknown): ReadingReviewReasonCode | null {
  const canonical = canonicalizeReviewReasonCode(typeof value === "string" ? value : null);
  if (!canonical) return null;
  return FLAG_REASON_OPTIONS.some((reason) => reason.code === canonical)
    ? (canonical as ReadingReviewReasonCode)
    : null;
}

export function normalizeRejectionReasonCode(value: unknown): ReadingReviewReasonCode | null {
  const canonical = canonicalizeReviewReasonCode(typeof value === "string" ? value : null);
  if (!canonical) return null;
  return REJECTION_REASON_OPTIONS.some((reason) => reason.code === canonical)
    ? (canonical as ReadingReviewReasonCode)
    : null;
}

export function getReviewReasonLabel(value: string | null | undefined) {
  const canonical = canonicalizeReviewReasonCode(value);
  if (!canonical) return null;
  return REASON_META_BY_CODE.get(canonical as ReadingReviewReasonCode)?.label || canonical;
}

export function getClientFacingReviewReasonMessage(value: string | null | undefined) {
  const canonical = canonicalizeReviewReasonCode(value);
  if (!canonical) return null;
  return REASON_META_BY_CODE.get(canonical as ReadingReviewReasonCode)?.clientMessage || canonical;
}

export function getReadingStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "PENDING":
      return "En attente";
    case "VALIDATED":
      return "Validé";
    case "FLAGGED":
      return "En vérification";
    case "REJECTED":
      return "Rejeté";
    case "RESUBMISSION_REQUESTED":
      return "Nouvelle soumission demandée";
    default:
      return status || null;
  }
}

export function getClientReadingDecisionTitle(
  status: string | null | undefined,
  reasonCode?: string | null
) {
  switch (status) {
    case "VALIDATED":
      return "Relevé validé";
    case "FLAGGED":
      return getReviewReasonLabel(reasonCode) || "Relevé en vérification";
    case "REJECTED":
      return getReviewReasonLabel(reasonCode) || "Relevé rejeté";
    case "RESUBMISSION_REQUESTED":
      return "Nouvelle soumission demandée";
    default:
      return getReadingStatusLabel(status);
  }
}

export function getClientReadingDecisionMessage(
  status: string | null | undefined,
  reasonCode?: string | null,
  meterSerialNumber?: string | null
) {
  const meterRef = meterSerialNumber ? ` pour le compteur ${meterSerialNumber}` : "";

  switch (status) {
    case "VALIDATED":
      return `Votre relevé${meterRef} a été validé par notre équipe.`;
    case "FLAGGED":
      return (
        getClientFacingReviewReasonMessage(reasonCode) ||
        `Votre relevé${meterRef} nécessite une vérification complémentaire.`
      );
    case "REJECTED":
      return (
        getClientFacingReviewReasonMessage(reasonCode) ||
        `Votre relevé${meterRef} n'a pas pu être validé. Merci de le reprendre.`
      );
    case "RESUBMISSION_REQUESTED":
      return `Une nouvelle soumission est demandée${meterRef}. Merci de refaire le relevé.`;
    default:
      return null;
  }
}
