import Link from "next/link";

export default function BillingSchemaNotice() {
  return (
    <div className="rounded-2xl border border-warning-200 bg-warning-50 p-5 text-sm text-warning-800 dark:border-warning-500/40 dark:bg-warning-500/10 dark:text-warning-200">
      <p className="font-semibold">Billing module is not initialized in the database.</p>
      <p className="mt-1">
        Apply Prisma migrations before using billing pages.
      </p>
      <p className="mt-2 font-mono text-xs">
        npx prisma migrate deploy
      </p>
      <p className="mt-3">
        Then reload billing pages: <Link href="/admin/billing" className="underline">/admin/billing</Link>
      </p>
    </div>
  );
}
