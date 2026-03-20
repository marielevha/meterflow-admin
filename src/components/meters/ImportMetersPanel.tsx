"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminI18n } from "@/hooks/use-admin-i18n";
import { getAccessToken } from "@/lib/auth/clientSession";

type PreviewRow = {
  rowNumber: number;
  errors: string[];
  normalized: {
    serialNumber: string;
    meterReference: string;
    type: string;
    status: string;
    customerPhone: string;
    customerId: string;
    customerLabel: string;
    assignedAgentUsername: string;
    assignedAgentId: string | null;
    assignedAgentLabel: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    zone: string;
    latitude: number | null;
    longitude: number | null;
    installedAt: string | null;
    lastInspectionAt: string | null;
  };
};

type PreviewResponse = {
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
  };
  rows: PreviewRow[];
  validRows: PreviewRow["normalized"][];
};

function formatError(code: string) {
  return code.replaceAll("_", " ");
}

export default function ImportMetersPanel() {
  const { t } = useAdminI18n();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const latestRequestRef = useRef(0);

  const invalidRows = useMemo(
    () => (preview ? preview.rows.filter((row) => row.errors.length > 0) : []),
    [preview]
  );

  const handlePreview = useCallback(async (fileToPreview: File) => {
    setError("");
    setSuccess("");
    setIsPreviewing(true);
    const requestId = Date.now();
    latestRequestRef.current = requestId;

    try {
      const formData = new FormData();
      formData.append("file", fileToPreview);
      const accessToken = getAccessToken();
      const response = await fetch("/api/v1/meters/import/preview", {
        method: "POST",
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        body: formData,
      });
      const data = await response.json();
      if (latestRequestRef.current !== requestId) return;

      if (!response.ok) {
        if (Array.isArray(data?.missingHeaders)) {
          setError(t("meterImport.missingColumns", { columns: data.missingHeaders.join(", ") }));
        } else {
          setError(data?.error || t("meterImport.previewFailed"));
        }
        return;
      }

      setPreview(data as PreviewResponse);
    } catch {
      if (latestRequestRef.current !== requestId) return;
      setError(t("meterImport.networkPreview"));
    } finally {
      if (latestRequestRef.current === requestId) {
        setIsPreviewing(false);
      }
    }
  }, [t]);

  useEffect(() => {
    if (!file) return;
    setPreview(null);
    void handlePreview(file);
  }, [file, handlePreview]);

  async function handleImport() {
    if (!preview || preview.validRows.length === 0) {
      setError(t("meterImport.noValidRows"));
      return;
    }

    setError("");
    setSuccess("");
    setIsImporting(true);
    try {
      const accessToken = getAccessToken();
      const response = await fetch("/api/v1/meters/import/commit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ rows: preview.validRows }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data?.error || t("meterImport.importFailed"));
        return;
      }

      setSuccess(t("meterImport.importSuccess", { count: data.importedCount }));
      setPreview(null);
      setFile(null);
      router.refresh();
    } catch {
      setError(t("meterImport.networkImport"));
    } finally {
      setIsImporting(false);
    }
  }

  async function handleDownloadTemplate() {
    await handleDownloadCsv("/api/v1/meters/import/template", "meters_import_template.csv");
  }

  async function handleDownloadDemo() {
    await handleDownloadCsv("/api/v1/meters/import/demo", "meters_import_demo.csv");
  }

  async function handleDownloadCsv(urlPath: string, filename: string) {
    try {
      const accessToken = getAccessToken();
      const response = await fetch(urlPath, {
        method: "GET",
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error || t("meterImport.unableToDownload"));
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch {
      setError(t("meterImport.networkDownload"));
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{t("meterImport.csvImportTitle")}</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t("meterImport.csvImportDescription")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
            >
              {t("meterImport.downloadTemplate")}
            </button>
            <button
              type="button"
              onClick={handleDownloadDemo}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-brand-200 bg-brand-50 px-4 text-sm font-medium text-brand-700 hover:bg-brand-100 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300 dark:hover:bg-brand-500/20"
            >
              {t("meterImport.downloadDemoCsv")}
            </button>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t("meterImport.meterCsvFile")}
          </label>
          <input
            type="file"
            accept=".csv,text/csv,application/vnd.ms-excel"
            onChange={(event) => {
              const selectedFile = event.target.files?.[0] ?? null;
              setFile(selectedFile);
              setPreview(null);
              setError("");
              setSuccess("");
              latestRequestRef.current = 0;
            }}
            className="block w-full text-sm text-gray-700 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-500 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-600 dark:text-gray-300"
          />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <HintCard
            title={t("meterImport.requiredColumns")}
            value="serial_number, type, customer_phone"
          />
          <HintCard
            title={t("meterImport.optionalAssignment")}
            value="assigned_agent_username"
          />
          <HintCard
            title={t("meterImport.optionalMetadata")}
            value="reference, status, location, dates"
          />
        </div>
      </section>

      {error ? (
        <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-300">
          {success}
        </div>
      ) : null}

      {isPreviewing ? (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300">
          {t("meterImport.previewingFile")}
        </div>
      ) : null}

      {preview ? (
        <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SummaryCard label={t("meterImport.totalRows")} value={preview.summary.totalRows} />
            <SummaryCard label={t("meterImport.validRows")} value={preview.summary.validRows} />
            <SummaryCard label={t("meterImport.invalidRows")} value={preview.summary.invalidRows} />
          </div>

          {invalidRows.length > 0 ? (
            <div className="mt-5 rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300">
              {t("meterImport.invalidRowsDetected", { count: invalidRows.length })}
            </div>
          ) : null}

          <div className="mt-5 max-w-full overflow-x-auto">
            <div className="min-w-[1400px] overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
              <table className="w-full">
                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900">
                  <tr>
                    {[
                      t("meterImport.row"),
                      t("meterImport.serial"),
                      t("meterImport.reference"),
                      t("meterImport.type"),
                      t("meterImport.status"),
                      t("meterImport.customer"),
                      t("meterImport.assignedAgent"),
                      t("meterImport.location"),
                      t("meterImport.gps"),
                      t("meterImport.dates"),
                      t("meterImport.errors"),
                    ].map((head) => (
                      <th key={head} className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => (
                    <tr key={row.rowNumber} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">{row.rowNumber}</td>
                      <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">{row.normalized.serialNumber}</td>
                      <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">{row.normalized.meterReference || "-"}</td>
                      <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">{row.normalized.type}</td>
                      <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">{row.normalized.status}</td>
                      <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                        {row.normalized.customerLabel || row.normalized.customerPhone}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                        {row.normalized.assignedAgentLabel || row.normalized.assignedAgentUsername || "-"}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                        {[row.normalized.city, row.normalized.zone].filter(Boolean).join(" / ") || "-"}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                        {row.normalized.latitude !== null && row.normalized.longitude !== null
                          ? `${row.normalized.latitude}, ${row.normalized.longitude}`
                          : "-"}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                        {row.normalized.installedAt || "-"}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                        {row.errors.length > 0 ? row.errors.map(formatError).join(", ") : t("meterImport.ok")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setFile(null);
                setPreview(null);
                setError("");
                setSuccess("");
              }}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
            >
              {t("common.reset")}
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={isImporting || preview.validRows.length === 0}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isImporting ? t("meterImport.importing") : t("meterImport.importValidRows")}
            </button>
          </div>
        </section>
      ) : file === null ? (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-6 text-sm text-gray-500 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-400">
          {t("meterImport.noPreviewYet")}
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-white/[0.02]">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">{value}</p>
    </div>
  );
}

function HintCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-white/[0.02]">
      <p className="text-xs text-gray-500 dark:text-gray-400">{title}</p>
      <p className="mt-2 text-sm font-medium text-gray-800 dark:text-white/90">{value}</p>
    </div>
  );
}
