import { Metadata } from "next";
import Link from "next/link";
import { Prisma, ReadingEventType } from "@prisma/client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import ComponentCard from "@/components/common/ComponentCard";
import Badge from "@/components/ui/badge/Badge";
import MeterStatesFilters from "@/components/history/MeterStatesFilters";
import ReadingEventsFilters from "@/components/history/ReadingEventsFilters";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "History",
  description: "History and audit overview",
};

const PAGE_SIZE_OPTIONS = [10, 20, 50];

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(input: string | string[] | undefined): string {
  if (Array.isArray(input)) return input[0] ?? "";
  return input ?? "";
}

function buildPager(current: number, total: number) {
  const startPage = Math.max(1, current - 2);
  const endPage = Math.min(total, startPage + 4);
  return Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const resolved = await searchParams;

  const msQ = firstValue(resolved.msQ).trim();
  const msHasSource = firstValue(resolved.msHasSource).trim();
  const msPageSizeRaw = Number(firstValue(resolved.msPageSize) || "10");
  const msPageSize = PAGE_SIZE_OPTIONS.includes(msPageSizeRaw) ? msPageSizeRaw : 10;
  const msRequestedPage = Math.max(1, Number(firstValue(resolved.msPage) || "1"));

  const evQ = firstValue(resolved.evQ).trim();
  const evType = firstValue(resolved.evType).trim();
  const evPageSizeRaw = Number(firstValue(resolved.evPageSize) || "10");
  const evPageSize = PAGE_SIZE_OPTIONS.includes(evPageSizeRaw) ? evPageSizeRaw : 10;
  const evRequestedPage = Math.max(1, Number(firstValue(resolved.evPage) || "1"));

  const meterStatesWhere: Prisma.MeterStateWhereInput = {
    deletedAt: null,
    ...(msHasSource === "with"
      ? { sourceReadingId: { not: null } }
      : msHasSource === "without"
        ? { sourceReadingId: null }
        : {}),
    ...(msQ
      ? {
          meter: {
            serialNumber: { contains: msQ, mode: "insensitive" },
          },
        }
      : {}),
  };

  const readingEventsWhere: Prisma.ReadingEventWhereInput = {
    deletedAt: null,
    ...(evType && (Object.values(ReadingEventType) as string[]).includes(evType)
      ? { type: evType as ReadingEventType }
      : {}),
    ...(evQ
      ? {
          OR: [
            { reading: { meter: { serialNumber: { contains: evQ, mode: "insensitive" } } } },
            { user: { firstName: { contains: evQ, mode: "insensitive" } } },
            { user: { lastName: { contains: evQ, mode: "insensitive" } } },
            { user: { phone: { contains: evQ } } },
          ],
        }
      : {}),
  };

  const [meterStatesTotal, readingEventsTotal] = await prisma.$transaction([
    prisma.meterState.count({ where: meterStatesWhere }),
    prisma.readingEvent.count({ where: readingEventsWhere }),
  ]);

  const msTotalPages = Math.max(1, Math.ceil(meterStatesTotal / msPageSize));
  const msPage = Math.min(msRequestedPage, msTotalPages);
  const msSkip = (msPage - 1) * msPageSize;

  const evTotalPages = Math.max(1, Math.ceil(readingEventsTotal / evPageSize));
  const evPage = Math.min(evRequestedPage, evTotalPages);
  const evSkip = (evPage - 1) * evPageSize;

  const [meterStates, readingEvents] = await prisma.$transaction([
    prisma.meterState.findMany({
      where: meterStatesWhere,
      orderBy: { effectiveAt: "desc" },
      skip: msSkip,
      take: msPageSize,
      include: {
        meter: { select: { serialNumber: true } },
        sourceReading: { select: { id: true, status: true } },
      },
    }),
    prisma.readingEvent.findMany({
      where: readingEventsWhere,
      orderBy: { createdAt: "desc" },
      skip: evSkip,
      take: evPageSize,
      include: {
        reading: {
          select: {
            id: true,
            status: true,
            meter: { select: { serialNumber: true } },
          },
        },
        user: { select: { firstName: true, lastName: true, phone: true } },
      },
    }),
  ]);

  const msVisiblePages = buildPager(msPage, msTotalPages);
  const evVisiblePages = buildPager(evPage, evTotalPages);

  const buildMeterStatesHref = (page: number) => {
    const params = new URLSearchParams();
    if (msQ) params.set("msQ", msQ);
    if (msHasSource) params.set("msHasSource", msHasSource);
    params.set("msPageSize", String(msPageSize));
    if (page > 1) params.set("msPage", String(page));

    if (evQ) params.set("evQ", evQ);
    if (evType) params.set("evType", evType);
    params.set("evPageSize", String(evPageSize));
    if (evPage > 1) params.set("evPage", String(evPage));

    return `/admin/history${params.toString() ? `?${params.toString()}` : ""}`;
  };

  const buildReadingEventsHref = (page: number) => {
    const params = new URLSearchParams();
    if (msQ) params.set("msQ", msQ);
    if (msHasSource) params.set("msHasSource", msHasSource);
    params.set("msPageSize", String(msPageSize));
    if (msPage > 1) params.set("msPage", String(msPage));

    if (evQ) params.set("evQ", evQ);
    if (evType) params.set("evType", evType);
    params.set("evPageSize", String(evPageSize));
    if (page > 1) params.set("evPage", String(page));

    return `/admin/history${params.toString() ? `?${params.toString()}` : ""}`;
  };

  return (
    <div>
      <PageBreadcrumb pageTitle="History" />

      <div className="grid grid-cols-1 gap-6">
        <ComponentCard title="Meter states history" desc="Evolution des index par compteur.">
          <MeterStatesFilters
            initialMsQ={msQ}
            initialMsHasSource={msHasSource}
            initialMsPageSize={msPageSize}
            evQ={evQ}
            evType={evType}
            evPageSize={evPageSize}
            evPage={evPage}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
          />

          <div className="max-w-full overflow-x-auto">
            <div className="min-w-[1100px] overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
              <Table>
                <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                  <TableRow>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Effective at</TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Meter</TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Previous</TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Current</TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Source reading</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {meterStates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                        No history found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    meterStates.map((state) => (
                      <TableRow key={state.id}>
                        <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {state.effectiveAt.toISOString().slice(0, 19).replace("T", " ")}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{state.meter.serialNumber}</TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {state.previousPrimary?.toString() || "-"}
                          {state.previousSecondary ? ` | ${state.previousSecondary.toString()}` : ""}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {state.currentPrimary?.toString() || "-"}
                          {state.currentSecondary ? ` | ${state.currentSecondary.toString()}` : ""}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {state.sourceReading ? (
                            <Badge size="sm" color="info">
                              {state.sourceReading.status}
                            </Badge>
                          ) : (
                            "N/A"
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Showing {meterStates.length === 0 ? 0 : msSkip + 1} - {Math.min(msSkip + meterStates.length, meterStatesTotal)} of{" "}
              {meterStatesTotal} states
            </p>
            <div className="flex items-center gap-2">
              <Link
                href={buildMeterStatesHref(msPage - 1)}
                aria-disabled={msPage <= 1}
                className={`inline-flex h-10 items-center justify-center rounded-lg border px-3 text-sm ${
                  msPage <= 1
                    ? "pointer-events-none border-gray-200 text-gray-400 dark:border-gray-800 dark:text-gray-600"
                    : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
                }`}
              >
                Previous
              </Link>
              {msVisiblePages.map((pageNumber) => (
                <Link
                  key={pageNumber}
                  href={buildMeterStatesHref(pageNumber)}
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-lg text-sm font-medium ${
                    pageNumber === msPage
                      ? "bg-brand-500 text-white"
                      : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/[0.03]"
                  }`}
                >
                  {pageNumber}
                </Link>
              ))}
              <Link
                href={buildMeterStatesHref(msPage + 1)}
                aria-disabled={msPage >= msTotalPages}
                className={`inline-flex h-10 items-center justify-center rounded-lg border px-3 text-sm ${
                  msPage >= msTotalPages
                    ? "pointer-events-none border-gray-200 text-gray-400 dark:border-gray-800 dark:text-gray-600"
                    : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
                }`}
              >
                Next
              </Link>
            </div>
          </div>
        </ComponentCard>

        <ComponentCard title="Reading events audit trail" desc="Trace complete des actions effectuees sur les releves.">
          <ReadingEventsFilters
            initialEvQ={evQ}
            initialEvType={evType}
            initialEvPageSize={evPageSize}
            msQ={msQ}
            msHasSource={msHasSource}
            msPageSize={msPageSize}
            msPage={msPage}
            eventTypeOptions={Object.values(ReadingEventType)}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
          />

          <div className="max-w-full overflow-x-auto">
            <div className="min-w-[1200px] overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
              <Table>
                <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                  <TableRow>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Created at</TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Event</TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Reading</TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Meter</TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">User</TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Payload</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {readingEvents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                        No events found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    readingEvents.map((event) => {
                      const actor =
                        [event.user?.firstName, event.user?.lastName].filter(Boolean).join(" ").trim() ||
                        event.user?.phone ||
                        "System";
                      return (
                        <TableRow key={event.id}>
                          <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                            {event.createdAt.toISOString().slice(0, 19).replace("T", " ")}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{event.type}</TableCell>
                          <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                            <Badge size="sm" color="light">
                              {event.reading.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{event.reading.meter.serialNumber}</TableCell>
                          <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{actor}</TableCell>
                          <TableCell className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                            <pre className="max-w-[340px] overflow-hidden text-ellipsis whitespace-pre-wrap break-words">
                              {JSON.stringify(event.payload)}
                            </pre>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Showing {readingEvents.length === 0 ? 0 : evSkip + 1} - {Math.min(evSkip + readingEvents.length, readingEventsTotal)} of{" "}
              {readingEventsTotal} events
            </p>
            <div className="flex items-center gap-2">
              <Link
                href={buildReadingEventsHref(evPage - 1)}
                aria-disabled={evPage <= 1}
                className={`inline-flex h-10 items-center justify-center rounded-lg border px-3 text-sm ${
                  evPage <= 1
                    ? "pointer-events-none border-gray-200 text-gray-400 dark:border-gray-800 dark:text-gray-600"
                    : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
                }`}
              >
                Previous
              </Link>
              {evVisiblePages.map((pageNumber) => (
                <Link
                  key={pageNumber}
                  href={buildReadingEventsHref(pageNumber)}
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-lg text-sm font-medium ${
                    pageNumber === evPage
                      ? "bg-brand-500 text-white"
                      : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/[0.03]"
                  }`}
                >
                  {pageNumber}
                </Link>
              ))}
              <Link
                href={buildReadingEventsHref(evPage + 1)}
                aria-disabled={evPage >= evTotalPages}
                className={`inline-flex h-10 items-center justify-center rounded-lg border px-3 text-sm ${
                  evPage >= evTotalPages
                    ? "pointer-events-none border-gray-200 text-gray-400 dark:border-gray-800 dark:text-gray-600"
                    : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
                }`}
              >
                Next
              </Link>
            </div>
          </div>
        </ComponentCard>
      </div>
    </div>
  );
}
