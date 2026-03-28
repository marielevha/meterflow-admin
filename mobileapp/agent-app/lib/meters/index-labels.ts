type Translator = (key: string, params?: Record<string, string | number>) => string;

export function getAgentMeterIndexLabels(meterType: string | null | undefined, t: Translator) {
  const isDual = meterType === 'DUAL_INDEX';

  return {
    primaryIndex: isDual ? t('missions.fieldHpIndex') : t('missions.fieldIndex'),
    secondaryIndex: t('missions.fieldHcIndex'),
    invalidPrimaryIndexBody: isDual ? t('missions.invalidHpIndexBody') : t('missions.invalidIndexBody'),
    invalidSecondaryIndexBody: t('missions.invalidHcIndexBody'),
  };
}
