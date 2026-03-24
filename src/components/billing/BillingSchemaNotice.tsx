"use client";

import Link from "next/link";
import { useAdminI18n } from "@/hooks/use-admin-i18n";

type BillingSchemaNoticeProps = {
  title?: string;
  message?: string;
  hint?: string;
  details?: string | null;
};

export default function BillingSchemaNotice({
  title,
  message,
  hint,
  details = null,
}: BillingSchemaNoticeProps) {
  const { t } = useAdminI18n();
  return (
    <div className="rounded-2xl border border-warning-200 bg-warning-50 p-5 text-sm text-warning-800 dark:border-warning-500/40 dark:bg-warning-500/10 dark:text-warning-200">
      <p className="font-semibold">{title || t("billing.schemaNoticeTitle")}</p>
      <p className="mt-1">{message || t("billing.schemaNoticeMessage")}</p>
      <p className="mt-2">{hint || t("billing.schemaNoticeHint")}</p>
      <p className="mt-2 font-mono text-xs">npx prisma migrate deploy</p>
      {details ? (
        <pre className="mt-3 overflow-x-auto rounded-lg bg-black/5 p-3 text-xs text-warning-900 dark:bg-black/20 dark:text-warning-100">
          {details}
        </pre>
      ) : null}
      <p className="mt-3">
        {t("billing.schemaNoticeReload")}{" "}
        <Link href="/admin/billing" className="underline">
          /admin/billing
        </Link>
      </p>
    </div>
  );
}
