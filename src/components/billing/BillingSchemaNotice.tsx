import Link from "next/link";

type BillingSchemaNoticeProps = {
  title?: string;
  message?: string;
  hint?: string;
  details?: string | null;
};

export default function BillingSchemaNotice({
  title = "Billing module is unavailable.",
  message = "The billing schema or data access layer is not aligned with the current application code.",
  hint = "Check Prisma migrations and schema alignment before using billing pages.",
  details = null,
}: BillingSchemaNoticeProps) {
  return (
    <div className="rounded-2xl border border-warning-200 bg-warning-50 p-5 text-sm text-warning-800 dark:border-warning-500/40 dark:bg-warning-500/10 dark:text-warning-200">
      <p className="font-semibold">{title}</p>
      <p className="mt-1">{message}</p>
      <p className="mt-2">{hint}</p>
      <p className="mt-2 font-mono text-xs">npx prisma migrate deploy</p>
      {details ? (
        <pre className="mt-3 overflow-x-auto rounded-lg bg-black/5 p-3 text-xs text-warning-900 dark:bg-black/20 dark:text-warning-100">
          {details}
        </pre>
      ) : null}
      <p className="mt-3">
        Then reload billing pages:{" "}
        <Link href="/admin/billing" className="underline">
          /admin/billing
        </Link>
      </p>
    </div>
  );
}
