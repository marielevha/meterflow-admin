import { Metadata } from "next";
import Link from "next/link";
import { MeterStatus, MeterType, UserRole } from "@prisma/client";
import { notFound } from "next/navigation";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import SearchableSelect from "@/components/form/SearchableSelect";
import { prisma } from "@/lib/prisma";
import { updateMeterAction } from "./actions";

export const metadata: Metadata = {
  title: "Edit Meter | MeterFlow Dashboard",
  description: "Edit meter page",
};

function messageFromError(errorCode: string) {
  if (errorCode === "required_fields") return "Serial number and customer are required.";
  if (errorCode === "invalid_type") return "Invalid meter type selected.";
  if (errorCode === "invalid_status") return "Invalid meter status selected.";
  if (errorCode === "update_failed") return "Update failed. Please try again.";
  return "";
}

function toInputDate(value: Date | null) {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

export default async function EditMeterPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const errorCode = Array.isArray(resolvedSearchParams.error)
    ? resolvedSearchParams.error[0]
    : resolvedSearchParams.error || "";

  const [meter, customers, agents] = await prisma.$transaction([
    prisma.meter.findFirst({
      where: { id, deletedAt: null },
    }),
    prisma.user.findMany({
      where: {
        deletedAt: null,
        role: UserRole.CLIENT,
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
      },
    }),
    prisma.user.findMany({
      where: {
        deletedAt: null,
        role: {
          in: [UserRole.AGENT, UserRole.SUPERVISOR, UserRole.ADMIN],
        },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
      },
    }),
  ]);

  if (!meter) {
    notFound();
  }

  const submit = updateMeterAction.bind(null, meter.id);
  const errorMessage = messageFromError(errorCode);
  const customerOptions = customers.map((customer) => {
    const name = [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim();
    return {
      value: customer.id,
      label: name || "Client",
      hint: customer.phone,
    };
  });
  const agentOptions = agents.map((agent) => {
    const name = [agent.firstName, agent.lastName].filter(Boolean).join(" ").trim();
    return {
      value: agent.id,
      label: name || "Agent",
      hint: agent.phone,
    };
  });

  return (
    <div>
      <PageBreadcrumb pageTitle="Edit meter" />

      <form action={submit} className="space-y-6">
        {errorMessage ? (
          <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300">
            {errorMessage}
          </div>
        ) : null}

        <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="mb-5">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Meter identity</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Primary identifiers and operational configuration.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <FormInput label="Serial number" name="serialNumber" defaultValue={meter.serialNumber} />
            <FormInput label="Reference" name="meterReference" defaultValue={meter.meterReference || ""} />

            <div>
              <Label htmlFor="type">Type</Label>
              <select
                id="type"
                name="type"
                defaultValue={meter.type}
                className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              >
                {Object.values(MeterType).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                name="status"
                defaultValue={meter.status}
                className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              >
                {Object.values(MeterStatus).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="mb-5">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Assignment</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Customer ownership and field assignment.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="customerId">Customer</Label>
              <SearchableSelect
                id="customerId"
                name="customerId"
                defaultValue={meter.customerId}
                options={customerOptions}
                placeholder="Search customer by name or phone"
                required
              />
            </div>

            <div>
              <Label htmlFor="assignedAgentId">Assigned agent</Label>
              <SearchableSelect
                id="assignedAgentId"
                name="assignedAgentId"
                defaultValue={meter.assignedAgentId || ""}
                options={agentOptions}
                placeholder="Search agent by name or phone"
                emptyLabel="Unassigned"
              />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="mb-5">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Location</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Address and GPS coordinates.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <FormInput label="Address line 1" name="addressLine1" defaultValue={meter.addressLine1 || ""} />
            <FormInput label="Address line 2" name="addressLine2" defaultValue={meter.addressLine2 || ""} />
            <FormInput label="City" name="city" defaultValue={meter.city || ""} />
            <FormInput label="Zone" name="zone" defaultValue={meter.zone || ""} />
            <FormInput label="Latitude" name="latitude" defaultValue={meter.latitude?.toString() || ""} />
            <FormInput label="Longitude" name="longitude" defaultValue={meter.longitude?.toString() || ""} />
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="mb-5">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Timeline</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Operational dates for this meter.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormInput
              label="Installed at"
              name="installedAt"
              type="date"
              defaultValue={toInputDate(meter.installedAt)}
            />
            <FormInput
              label="Last inspection at"
              name="lastInspectionAt"
              type="date"
              defaultValue={toInputDate(meter.lastInspectionAt)}
            />
          </div>
        </section>

        <div className="sticky bottom-4 z-30 rounded-xl border border-gray-200 bg-white/90 p-4 backdrop-blur dark:border-gray-800 dark:bg-gray-900/90">
          <div className="flex items-center justify-end gap-2">
            <Link
              href={`/admin/meters/${meter.id}`}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600"
            >
              Save changes
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function FormInput({
  label,
  name,
  defaultValue,
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
}) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} defaultValue={defaultValue} />
    </div>
  );
}
