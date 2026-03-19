const REASON_LABELS: Record<string, string> = {
  BLURRY_IMAGE: 'Photo floue',
  INDEX_NOT_READABLE: 'Index illisible',
  METER_NOT_VISIBLE: 'Compteur non visible',
  WRONG_METER: 'Mauvais compteur photographié',
  GPS_MISMATCH: 'Position GPS incohérente',
  INDEX_INCONSISTENT: 'Index incohérent',
  INVALID_INDEX_VALUE: "Valeur d'index invalide",
  SUSPECTED_TAMPERING: 'Suspicion de fraude ou altération',
  DUPLICATE_SUBMISSION: 'Soumission en doublon',
  OTHER_QUALITY_ISSUE: 'Contrôle complémentaire requis',
};

const FLAGGED_MESSAGES: Record<string, string> = {
  BLURRY_IMAGE: 'La photo paraît floue. Un contrôle complémentaire est nécessaire avant validation.',
  GPS_MISMATCH: 'La position de prise de vue semble éloignée du compteur enregistré.',
  INDEX_INCONSISTENT: "L'index transmis paraît incohérent avec l'historique du compteur.",
  SUSPECTED_TAMPERING: "Le relevé nécessite une vérification manuelle complémentaire par un agent.",
  OTHER_QUALITY_ISSUE: 'Le relevé nécessite une vérification complémentaire avant décision finale.',
};

const REJECTED_MESSAGES: Record<string, string> = {
  BLURRY_IMAGE: 'La photo est trop floue pour permettre une validation correcte. Merci de refaire le relevé.',
  INDEX_NOT_READABLE: "L'index du compteur n'est pas lisible sur la photo. Merci de reprendre une image plus nette.",
  METER_NOT_VISIBLE: "Le compteur n'est pas clairement visible sur la photo. Merci de refaire le relevé.",
  WRONG_METER: "Le compteur photographié ne correspond pas au compteur attendu pour ce compte.",
  INVALID_INDEX_VALUE: "La valeur d'index transmise est invalide. Merci de vérifier puis de renvoyer le relevé.",
  DUPLICATE_SUBMISSION: 'Ce relevé semble être un doublon et n’a pas été retenu.',
  OTHER_QUALITY_ISSUE: 'Le relevé ne peut pas être validé dans son état actuel. Merci de le refaire.',
};

export function getReviewReasonLabel(reason: string | null | undefined) {
  if (!reason) return null;
  return REASON_LABELS[reason] || reason;
}

export function getClientReviewReasonMessage(reason: string | null | undefined) {
  if (!reason) return null;
  return REJECTED_MESSAGES[reason] || FLAGGED_MESSAGES[reason] || getReviewReasonLabel(reason);
}

export function humanizeReadingStatus(status: string | null | undefined) {
  switch (status) {
    case 'PENDING':
      return 'En attente';
    case 'VALIDATED':
      return 'Validé';
    case 'FLAGGED':
      return 'En vérification';
    case 'REJECTED':
      return 'Rejeté';
    case 'RESUBMISSION_REQUESTED':
      return 'Nouvelle soumission demandée';
    default:
      return status || '--';
  }
}

export function getClientReviewDecisionTitle(status: string | null | undefined, reason: string | null | undefined) {
  switch (status) {
    case 'VALIDATED':
      return 'Relevé validé';
    case 'FLAGGED':
      return getReviewReasonLabel(reason) || 'Relevé en vérification';
    case 'REJECTED':
      return getReviewReasonLabel(reason) || 'Relevé rejeté';
    case 'RESUBMISSION_REQUESTED':
      return 'Nouvelle soumission demandée';
    default:
      return humanizeReadingStatus(status);
  }
}

export function getClientReviewDecisionMessage(
  status: string | null | undefined,
  reason: string | null | undefined
) {
  switch (status) {
    case 'VALIDATED':
      return 'Votre relevé a bien été validé par notre équipe.';
    case 'FLAGGED':
      return (
        (reason ? FLAGGED_MESSAGES[reason] : null) ||
        'Votre relevé nécessite une vérification complémentaire.'
      );
    case 'REJECTED':
      return (
        (reason ? REJECTED_MESSAGES[reason] : null) ||
        "Votre relevé n'a pas pu être validé. Merci de le reprendre."
      );
    case 'RESUBMISSION_REQUESTED':
      return 'Une nouvelle soumission est demandée. Merci de refaire le relevé.';
    default:
      return null;
  }
}
