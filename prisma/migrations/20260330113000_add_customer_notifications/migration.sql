CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE "customer_notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "action_path" TEXT,
    "metadata" JSONB DEFAULT '{}'::jsonb,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "customer_notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "customer_notifications_user_id_read_at_created_at_idx"
  ON "customer_notifications"("user_id", "read_at", "created_at");

CREATE INDEX "customer_notifications_type_created_at_idx"
  ON "customer_notifications"("type", "created_at");

CREATE INDEX "customer_notifications_deleted_at_idx"
  ON "customer_notifications"("deleted_at");

ALTER TABLE "customer_notifications"
  ADD CONSTRAINT "customer_notifications_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "customer_notifications" (
  "id",
  "user_id",
  "type",
  "title",
  "body",
  "action_path",
  "metadata",
  "read_at",
  "created_at",
  "updated_at",
  "deleted_at"
)
SELECT
  gen_random_uuid(),
  r."submitted_by_id",
  CASE re."type"
    WHEN 'VALIDATED' THEN 'READING_VALIDATED'
    WHEN 'FLAGGED' THEN 'READING_FLAGGED'
    WHEN 'REJECTED' THEN 'READING_REJECTED'
    ELSE 'READING_UPDATE'
  END,
  COALESCE(
    NULLIF(re."payload"->>'clientTitle', ''),
    CASE re."type"
      WHEN 'VALIDATED' THEN 'Relevé validé'
      WHEN 'FLAGGED' THEN 'Relevé en vérification'
      WHEN 'REJECTED' THEN 'Relevé rejeté'
      ELSE 'Mise à jour de relevé'
    END
  ),
  COALESCE(
    NULLIF(re."payload"->>'clientMessage', ''),
    CASE re."type"
      WHEN 'VALIDATED' THEN 'Votre relevé a été validé.'
      WHEN 'FLAGGED' THEN 'Votre relevé nécessite une vérification complémentaire.'
      WHEN 'REJECTED' THEN 'Votre relevé n''a pas pu être validé. Merci de le reprendre.'
      ELSE 'Une mise à jour est disponible pour votre relevé.'
    END
  ),
  '/readings/' || r."id"::text,
  jsonb_strip_nulls(
    jsonb_build_object(
      'category', 'READING',
      'readingId', r."id",
      'meterId', r."meter_id",
      'meterSerialNumber', m."serial_number",
      'status', CASE re."type"
        WHEN 'VALIDATED' THEN 'VALIDATED'
        WHEN 'FLAGGED' THEN 'FLAGGED'
        WHEN 'REJECTED' THEN 'REJECTED'
        ELSE NULL
      END,
      'reasonCode', COALESCE(NULLIF(re."payload"->>'reason', ''), r."flag_reason", r."rejection_reason")
    )
  ),
  legacy_read."read_at",
  re."created_at",
  re."updated_at",
  NULL
FROM "reading_events" re
JOIN "readings" r
  ON r."id" = re."reading_id"
 AND r."deleted_at" IS NULL
JOIN "meters" m
  ON m."id" = r."meter_id"
 AND m."deleted_at" IS NULL
LEFT JOIN LATERAL (
  SELECT MIN(mnr."read_at") AS "read_at"
  FROM "mobile_notification_reads" mnr
  WHERE mnr."reading_event_id" = re."id"
    AND mnr."user_id" = r."submitted_by_id"
) legacy_read ON TRUE
WHERE re."deleted_at" IS NULL
  AND re."type" IN ('VALIDATED', 'FLAGGED', 'REJECTED');

INSERT INTO "customer_notifications" (
  "id",
  "user_id",
  "type",
  "title",
  "body",
  "action_path",
  "metadata",
  "read_at",
  "created_at",
  "updated_at",
  "deleted_at"
)
SELECT
  gen_random_uuid(),
  i."customer_id",
  CASE ie."type"
    WHEN 'ISSUED' THEN 'INVOICE_ISSUED'
    WHEN 'DELIVERY_SENT' THEN 'INVOICE_DELIVERED'
    WHEN 'PAYMENT_REGISTERED' THEN 'INVOICE_PAYMENT_REGISTERED'
    WHEN 'CANCELED' THEN 'INVOICE_CANCELED'
    ELSE 'INVOICE_UPDATE'
  END,
  CASE ie."type"
    WHEN 'ISSUED' THEN 'Nouvelle facture disponible'
    WHEN 'DELIVERY_SENT' THEN 'Facture envoyée'
    WHEN 'PAYMENT_REGISTERED' THEN 'Paiement enregistré'
    WHEN 'CANCELED' THEN 'Facture annulée'
    ELSE 'Mise à jour de facturation'
  END,
  CASE ie."type"
    WHEN 'ISSUED' THEN 'Votre facture ' || i."invoice_number" || ' est disponible.'
    WHEN 'DELIVERY_SENT' THEN 'Votre facture ' || i."invoice_number" || ' a été envoyée.'
    WHEN 'PAYMENT_REGISTERED' THEN 'Un paiement a été enregistré sur votre facture ' || i."invoice_number" || '.'
    WHEN 'CANCELED' THEN 'Votre facture ' || i."invoice_number" || ' a été annulée.'
    ELSE 'Une mise à jour est disponible sur votre facture ' || i."invoice_number" || '.'
  END,
  '/notifications',
  jsonb_strip_nulls(
    jsonb_build_object(
      'category', 'BILLING',
      'invoiceId', i."id",
      'invoiceNumber', i."invoice_number",
      'meterId', i."meter_id",
      'meterSerialNumber', m."serial_number",
      'status', i."status",
      'amount', COALESCE((ie."payload"->>'amount')::numeric, i."total_amount"),
      'paidAmount', i."paid_amount",
      'dueDate', i."due_date",
      'channel', NULLIF(ie."payload"->>'channel', ''),
      'paymentMethod', NULLIF(ie."payload"->>'method', ''),
      'nextStatus', NULLIF(ie."payload"->>'nextStatus', '')
    )
  ),
  ie."created_at",
  ie."created_at",
  ie."updated_at",
  NULL
FROM "invoice_events" ie
JOIN "invoices" i
  ON i."id" = ie."invoice_id"
 AND i."deleted_at" IS NULL
JOIN "meters" m
  ON m."id" = i."meter_id"
 AND m."deleted_at" IS NULL
WHERE ie."deleted_at" IS NULL
  AND ie."type" IN ('ISSUED', 'DELIVERY_SENT', 'PAYMENT_REGISTERED', 'CANCELED');

INSERT INTO "customer_notifications" (
  "id",
  "user_id",
  "type",
  "title",
  "body",
  "action_path",
  "metadata",
  "read_at",
  "created_at",
  "updated_at",
  "deleted_at"
)
SELECT
  gen_random_uuid(),
  rrl."user_id",
  'READING_REMINDER',
  'Rappel auto-relevé',
  'Une fenêtre d''auto-relevé est ouverte. Merci de soumettre votre relevé dans l''application.',
  '/readings',
  jsonb_strip_nulls(
    jsonb_build_object(
      'category', 'REMINDER',
      'channel', rrl."channel",
      'pendingMeters', rrl."pending_meters",
      'windowStart', rrl."window_start",
      'windowEnd', rrl."window_end",
      'reason', rrl."reason"
    )
  ),
  rrl."created_at",
  rrl."created_at",
  rrl."updated_at",
  NULL
FROM "reading_reminder_logs" rrl
WHERE rrl."deleted_at" IS NULL
  AND rrl."status" = 'SENT';
