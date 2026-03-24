import {
  BillingCampaignStatus,
  DeliveryChannel,
  InvoiceStatus,
  MeterStatus,
  MeterType,
  PaymentMethod,
  ReadingEventType,
  ReadingStatus,
  TaskEventType,
  TaskItemStatus,
  TaskPriority,
  TaskStatus,
  TaskType,
  TariffBillingMode,
  UserRole,
  UserStatus,
} from "@prisma/client";

type Translator = (key: string, values?: Record<string, string | number>) => string;

export function translateMeterStatus(status: MeterStatus, t: Translator) {
  if (status === MeterStatus.ACTIVE) return t("meters.statusActive");
  if (status === MeterStatus.MAINTENANCE) return t("meters.statusMaintenance");
  if (status === MeterStatus.REPLACED) return t("meters.statusReplaced");
  return status;
}

export function translateMeterType(type: MeterType, t: Translator) {
  if (type === MeterType.DUAL_INDEX) return t("meters.typeDualIndex");
  return t("meters.typeSingleIndex");
}

export function translateUserRole(role: UserRole | string, t: Translator) {
  if (role === UserRole.ADMIN || role === "ADMIN") return t("users.roleAdmin");
  if (role === UserRole.SUPERVISOR || role === "SUPERVISOR") return t("users.roleSupervisor");
  if (role === UserRole.AGENT || role === "AGENT") return t("users.roleAgent");
  return t("users.roleClient");
}

export function translateUserStatus(status: UserStatus, t: Translator) {
  if (status === UserStatus.ACTIVE) return t("users.statusActive");
  if (status === UserStatus.SUSPENDED) return t("users.statusSuspended");
  return t("users.statusPending");
}

export function translateTaskStatus(status: TaskStatus, t: Translator) {
  if (status === TaskStatus.OPEN) return t("tasks.open");
  if (status === TaskStatus.IN_PROGRESS) return t("tasks.inProgress");
  if (status === TaskStatus.BLOCKED) return t("tasks.blocked");
  if (status === TaskStatus.DONE) return t("tasks.done");
  return t("tasks.canceled");
}

export function translateTaskPriority(priority: TaskPriority, t: Translator) {
  if (priority === TaskPriority.LOW) return t("tasks.priorityLow");
  if (priority === TaskPriority.MEDIUM) return t("tasks.priorityMedium");
  if (priority === TaskPriority.HIGH) return t("tasks.priorityHigh");
  return t("tasks.priorityCritical");
}

export function translateTaskType(type: TaskType, t: Translator) {
  if (type === TaskType.FIELD_RECHECK) return t("tasks.typeFieldRecheck");
  if (type === TaskType.FRAUD_INVESTIGATION) return t("tasks.typeFraudInvestigation");
  if (type === TaskType.METER_VERIFICATION) return t("tasks.typeMeterVerification");
  return t("tasks.typeGeneral");
}

export function translateTaskEventType(type: TaskEventType, t: Translator) {
  if (type === TaskEventType.ASSIGNED) return t("tasks.eventAssigned");
  if (type === TaskEventType.STARTED) return t("tasks.eventStarted");
  if (type === TaskEventType.BLOCKED) return t("tasks.eventBlocked");
  if (type === TaskEventType.COMPLETED) return t("tasks.eventCompleted");
  return t("tasks.eventFieldResultSubmitted");
}

export function translateTaskItemStatus(status: TaskItemStatus, t: Translator) {
  if (status === TaskItemStatus.DONE) return t("tasks.itemDone");
  if (status === TaskItemStatus.CANCELED) return t("tasks.canceled");
  return t("tasks.itemTodo");
}

export function translateTaskResolutionCode(value: string | null | undefined, t: Translator) {
  switch (value) {
    case "READING_CONFIRMED":
      return t("tasks.resolutionReadingConfirmed");
    case "READING_IMPOSSIBLE":
      return t("tasks.resolutionReadingImpossible");
    case "METER_INACCESSIBLE":
      return t("tasks.resolutionMeterInaccessible");
    case "METER_DAMAGED_OR_MISSING":
      return t("tasks.resolutionMeterDamagedOrMissing");
    case "SUSPECTED_FRAUD":
      return t("tasks.resolutionSuspectedFraud");
    case "CUSTOMER_ABSENT":
      return t("tasks.resolutionCustomerAbsent");
    case "ESCALATION_REQUIRED":
      return t("tasks.resolutionEscalationRequired");
    default:
      return value || t("common.notAvailable");
  }
}

export function translateReadingStatus(status: ReadingStatus, t: Translator) {
  if (status === ReadingStatus.PENDING) return t("overview.pending");
  if (status === ReadingStatus.VALIDATED) return t("overview.validated");
  if (status === ReadingStatus.FLAGGED) return t("overview.flagged");
  if (status === ReadingStatus.REJECTED) return t("overview.rejected");
  return status;
}

export function translateReadingEventType(type: ReadingEventType, t: Translator) {
  switch (type) {
    case ReadingEventType.CREATED:
      return t("readings.eventCreated");
    case ReadingEventType.SUBMITTED:
      return t("readings.eventSubmitted");
    case ReadingEventType.VALIDATED:
      return t("readings.eventValidated");
    case ReadingEventType.FLAGGED:
      return t("readings.eventFlagged");
    case ReadingEventType.REJECTED:
      return t("readings.eventRejected");
    case ReadingEventType.RESUBMITTED:
      return t("readings.eventResubmitted");
    case ReadingEventType.TASK_CREATED:
      return t("readings.eventTaskCreated");
    case ReadingEventType.TASK_UPDATED:
      return t("readings.eventTaskUpdated");
    case ReadingEventType.ANOMALY_DETECTED:
      return t("readings.eventAnomalyDetected");
    default:
      return type;
  }
}

export function translateReadingSource(value: string | null | undefined, t: Translator) {
  if (value === "CLIENT") return t("readings.sourceClient");
  if (value === "AGENT") return t("readings.sourceAgent");
  if (value === "IMPORT") return t("readings.sourceImport");
  return value || t("common.notAvailable");
}

export function translateTariffBillingMode(mode: TariffBillingMode | string, t: Translator) {
  if (mode === TariffBillingMode.TIME_OF_USE || mode === "TIME_OF_USE") return t("billing.timeOfUse");
  return t("billing.singleRate");
}

export function translateBillingCampaignStatus(status: BillingCampaignStatus | string, t: Translator) {
  switch (status) {
    case BillingCampaignStatus.DRAFT:
    case "DRAFT":
      return t("billing.campaignStatusDraft");
    case BillingCampaignStatus.READY:
    case "READY":
      return t("billing.campaignStatusReady");
    case BillingCampaignStatus.RUNNING:
    case "RUNNING":
      return t("billing.campaignStatusRunning");
    case BillingCampaignStatus.GENERATED:
    case "GENERATED":
      return t("billing.campaignStatusGenerated");
    case BillingCampaignStatus.ISSUED:
    case "ISSUED":
      return t("billing.campaignStatusIssued");
    case BillingCampaignStatus.CLOSED:
    case "CLOSED":
      return t("billing.campaignStatusClosed");
    case BillingCampaignStatus.CANCELED:
    case "CANCELED":
      return t("billing.campaignStatusCanceled");
    default:
      return String(status);
  }
}

export function translateInvoiceStatus(status: InvoiceStatus | string, t: Translator) {
  switch (status) {
    case InvoiceStatus.DRAFT:
    case "DRAFT":
      return t("billing.statusDraft");
    case InvoiceStatus.PENDING_REVIEW:
    case "PENDING_REVIEW":
      return t("billing.statusPendingReview");
    case InvoiceStatus.ISSUED:
    case "ISSUED":
      return t("billing.statusIssued");
    case InvoiceStatus.DELIVERED:
    case "DELIVERED":
      return t("billing.statusDelivered");
    case InvoiceStatus.PARTIALLY_PAID:
    case "PARTIALLY_PAID":
      return t("billing.statusPartiallyPaid");
    case InvoiceStatus.PAID:
    case "PAID":
      return t("billing.statusPaid");
    case InvoiceStatus.OVERDUE:
    case "OVERDUE":
      return t("billing.statusOverdue");
    case InvoiceStatus.CANCELED:
    case "CANCELED":
      return t("billing.statusCanceled");
    default:
      return String(status);
  }
}

export function translatePaymentMethod(method: PaymentMethod | string, t: Translator) {
  switch (method) {
    case PaymentMethod.CASH:
    case "CASH":
      return t("billing.paymentMethodCash");
    case PaymentMethod.MOBILE_MONEY:
    case "MOBILE_MONEY":
      return t("billing.paymentMethodMobileMoney");
    case PaymentMethod.BANK_TRANSFER:
    case "BANK_TRANSFER":
      return t("billing.paymentMethodBankTransfer");
    case PaymentMethod.CARD:
    case "CARD":
      return t("billing.paymentMethodCard");
    default:
      return t("billing.paymentMethodOther");
  }
}

export function translateDeliveryChannel(channel: DeliveryChannel | string, t: Translator) {
  switch (channel) {
    case DeliveryChannel.SMS:
    case "SMS":
      return t("billing.deliveryChannelSms");
    case DeliveryChannel.EMAIL:
    case "EMAIL":
      return t("billing.deliveryChannelEmail");
    case DeliveryChannel.PORTAL:
    case "PORTAL":
      return t("billing.deliveryChannelPortal");
    case DeliveryChannel.PRINT:
    case "PRINT":
      return t("billing.deliveryChannelPrint");
    default:
      return String(channel);
  }
}

export function translateReviewReasonCode(value: string | null | undefined, t: Translator) {
  switch (value) {
    case "BLURRY_IMAGE":
      return t("readings.reasonBlurryImage");
    case "INDEX_NOT_READABLE":
      return t("readings.reasonIndexNotReadable");
    case "METER_NOT_VISIBLE":
      return t("readings.reasonMeterNotVisible");
    case "WRONG_METER":
      return t("readings.reasonWrongMeter");
    case "GPS_MISMATCH":
      return t("readings.reasonGpsMismatch");
    case "INDEX_INCONSISTENT":
      return t("readings.reasonIndexInconsistent");
    case "INVALID_INDEX_VALUE":
      return t("readings.reasonInvalidIndexValue");
    case "SUSPECTED_TAMPERING":
      return t("readings.reasonSuspectedTampering");
    case "DUPLICATE_SUBMISSION":
      return t("readings.reasonDuplicateSubmission");
    case "OTHER_QUALITY_ISSUE":
      return t("readings.reasonOtherQualityIssue");
    default:
      return value || t("common.notAvailable");
  }
}
