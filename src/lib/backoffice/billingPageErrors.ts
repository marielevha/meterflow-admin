import { Prisma } from "@prisma/client";
import { logError } from "@/lib/observability/logger";

type BillingPageErrorState = {
  title: string;
  message: string;
  hint: string;
  details: string | null;
};

function devDetails(error: unknown) {
  if (process.env.NODE_ENV === "production") return null;
  if (error instanceof Error) return error.message;
  return String(error);
}

export function getBillingPageErrorState(error: unknown, context: string): BillingPageErrorState {
  logError({
    event: "billing_page_query_failed",
    context,
    error: error instanceof Error ? error.message : "unknown_error",
  });

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2021") {
      return {
        title: "Billing tables are missing in the target database.",
        message: "The application reached the database, but one or more billing tables do not exist.",
        hint: "Apply pending billing migrations on the same PostgreSQL database used by the app.",
        details: devDetails(error),
      };
    }

    if (error.code === "P2022") {
      return {
        title: "Billing schema mismatch detected.",
        message: "Billing tables exist, but at least one expected column is missing or renamed.",
        hint: "Your database schema is older or different from the current Prisma schema. Re-run migrations and regenerate Prisma client.",
        details: devDetails(error),
      };
    }

    return {
      title: "Billing database access failed.",
      message: `Prisma reported a database error (${error.code}).`,
      hint: "Check the billing schema, constraints and migrations applied on the current database.",
      details: devDetails(error),
    };
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return {
      title: "Billing database connection failed.",
      message: "The billing pages could not initialize Prisma against the configured database.",
      hint: "Check DATABASE_URL, database availability and Prisma client generation.",
      details: devDetails(error),
    };
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return {
      title: "Billing query and Prisma schema are out of sync.",
      message: "The code issued a query that does not match the Prisma model currently generated.",
      hint: "Run prisma generate and ensure the app is using the latest schema/client build.",
      details: devDetails(error),
    };
  }

  return {
    title: "Billing page failed to load.",
    message: "An unexpected error happened while reading billing data.",
    hint: "Check application logs for the exact Prisma/database error.",
    details: devDetails(error),
  };
}
