"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { useModal } from "@/hooks/useModal";
import { getAccessToken } from "@/lib/auth/clientSession";

type PreviewRow = {
  rowNumber: number;
  errors: string[];
  normalized: {
    phone: string;
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    region: string;
    city: string;
    zone: string;
    status: string;
    roleCodes: string[];
    password: string;
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

export default function ImportUsersModal() {
  const { isOpen, openModal, closeModal } = useModal();
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [error, setError] = useState("");
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const latestRequestRef = useRef(0);

  const invalidRows = useMemo(
    () => (preview ? preview.rows.filter((row) => row.errors.length > 0) : []),
    [preview]
  );

  function resetState() {
    setFile(null);
    setPreview(null);
    setError("");
    setIsPreviewing(false);
    setIsImporting(false);
  }

  function handleClose() {
    resetState();
    closeModal();
  }

  async function handlePreview(fileToPreview: File) {
    setError("");
    setIsPreviewing(true);
    const requestId = Date.now();
    latestRequestRef.current = requestId;

    try {
      const formData = new FormData();
      formData.append("file", fileToPreview);
      const accessToken = getAccessToken();

      const response = await fetch("/api/v1/users/import/preview", {
        method: "POST",
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        body: formData,
      });
      const data = await response.json();
      if (latestRequestRef.current !== requestId) return;

      if (!response.ok) {
        if (Array.isArray(data?.missingHeaders)) {
          setError(`Colonnes manquantes: ${data.missingHeaders.join(", ")}`);
        } else {
          setError(data?.error || "Erreur de verification.");
        }
        return;
      }

      setPreview(data as PreviewResponse);
    } catch {
      if (latestRequestRef.current !== requestId) return;
      setError("Erreur reseau pendant la verification.");
    } finally {
      if (latestRequestRef.current === requestId) {
        setIsPreviewing(false);
      }
    }
  }

  useEffect(() => {
    if (!file) return;
    setPreview(null);
    void handlePreview(file);
  }, [file]);

  async function handleImport() {
    if (!preview || preview.validRows.length === 0) {
      setError("Aucune ligne valide a importer.");
      return;
    }

    setError("");
    setIsImporting(true);
    try {
      const accessToken = getAccessToken();
      const response = await fetch("/api/v1/users/import/commit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ rows: preview.validRows }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data?.error || "Erreur pendant l'import.");
        return;
      }

      handleClose();
      router.refresh();
    } catch {
      setError("Erreur reseau pendant l'import.");
    } finally {
      setIsImporting(false);
    }
  }

  async function handleDownloadTemplate() {
    try {
      const accessToken = getAccessToken();
      const response = await fetch("/api/v1/users/import/template", {
        method: "GET",
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error || "Impossible de telecharger le template.");
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "users_import_template.csv";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch {
      setError("Erreur reseau pendant le telechargement du template.");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600"
      >
        Import users
      </button>

      <Modal isOpen={isOpen} onClose={handleClose} className="max-w-[980px] p-6 lg:p-8">
        <div>
          <div className="mb-5">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">Import users</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Charge un CSV compatible Excel, verifie la coherence, puis importe en base.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Fichier CSV
            </label>
            <input
              type="file"
              accept=".csv,text/csv,application/vnd.ms-excel"
              onChange={(event) => {
                const selectedFile = event.target.files?.[0] ?? null;
                setFile(selectedFile);
                setPreview(null);
                setError("");
                latestRequestRef.current = 0;
              }}
              className="block w-full text-sm text-gray-700 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-500 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-600 dark:text-gray-300"
            />
          </div>

          {error ? (
            <div className="mt-4 rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300">
              {error}
            </div>
          ) : null}

          {preview ? (
            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <SummaryCard label="Total rows" value={preview.summary.totalRows} />
                <SummaryCard label="Valid rows" value={preview.summary.validRows} />
                <SummaryCard label="Invalid rows" value={preview.summary.invalidRows} />
              </div>

              {invalidRows.length > 0 ? (
                <div className="rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-orange-300">
                  {invalidRows.length} lignes invalides detectees. Elles ne seront pas importees.
                </div>
              ) : null}

              <div className="max-h-72 overflow-auto rounded-xl border border-gray-200 dark:border-gray-800">
                <table className="min-w-[1500px] w-full">
                  <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Row</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Phone</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Username</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Email</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">First name</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Last name</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Region</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">City</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Zone</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Roles</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Password</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row) => (
                      <tr key={row.rowNumber} className="border-t border-gray-100 dark:border-gray-800">
                        <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">{row.rowNumber}</td>
                        <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">{row.normalized.phone}</td>
                        <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                          {row.normalized.username || "-"}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                          {row.normalized.email || "-"}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                          {row.normalized.firstName || "-"}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                          {row.normalized.lastName || "-"}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                          {row.normalized.region || "-"}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                          {row.normalized.city || "-"}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                          {row.normalized.zone || "-"}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                          {row.normalized.status || "-"}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                          {row.normalized.roleCodes.join(" | ")}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                          {row.normalized.password || "-"}
                        </td>
                        <td className="px-3 py-2 text-xs text-error-600 dark:text-error-400">
                          {row.errors.length ? row.errors.join(", ") : "OK"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <div className="mt-6 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
            >
              Download template
            </button>

            <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={!preview || isImporting || isPreviewing || preview.validRows.length === 0}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
            >
              {isPreviewing ? "Verifying..." : isImporting ? "Importing..." : "Import valid rows"}
            </button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-white/[0.02]">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-gray-800 dark:text-white/90">{value}</p>
    </div>
  );
}
