type Translator = (key: string, params?: Record<string, string | number>) => string;

export function getCustomerMeterIndexLabels(meterType: string | null | undefined, t: Translator) {
  const isDual = meterType === 'DUAL_INDEX';

  return {
    primaryIndex: isDual ? t('common.hpIndex') : t('common.index'),
    secondaryIndex: t('common.hcIndex'),
    primaryConsumption: isDual ? t('common.hpShort') : t('common.total'),
    secondaryConsumption: t('common.hcShort'),
    invalidPrimaryIndexBody: isDual
      ? t('readingsFlow.alert.invalidHpIndexBody')
      : t('readingsFlow.alert.invalidIndexBody'),
    invalidSecondaryIndexBody: t('readingsFlow.alert.invalidHcIndexBody'),
    secondaryIndexRequiredTitle: t('readingsFlow.alert.hcIndexRequiredTitle'),
  };
}

export function getAggregateConsumptionLabels(t: Translator) {
  return {
    primaryConsumption: t('common.primaryShort'),
    secondaryConsumption: t('common.secondaryShort'),
  };
}
