"use client";

/** Import listings from a CSV and export listings or checks (admin only). Requirements: FR-39, FR-40, NFR-06, NFR-10.
 * UI spec 3.9 and its phase 14 details; decisions E1 to E3 in specs/2026-10-20-launch-readiness/requirements.md.
 * The chosen file is read in the browser and its text is sent (no multipart upload); nothing is kept. A download goes through the
 * staff token (a button, not a link) and is saved as a file.
 */
import { Download, Upload } from "lucide-react";
import { useState } from "react";

import { useStaff } from "@/components/admin/StaffGate";
import { buttonClasses } from "@/components/ui/buttonStyles";
import { DecorativeIcon } from "@/components/ui/DecorativeIcon";
import { ApiError } from "@/lib/api/request";
import { exportCsv, importListingsCsv, type ImportResult } from "@/lib/api/staff";

const MAX_BYTES = 1024 * 1024;
const COLUMNS = "name, category, area, address, landmark, latitude, longitude, phone, is_24_hours";

export function ImportExport() {
  const { call } = useStaff();
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [exportProblem, setExportProblem] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  async function runImport() {
    if (importing) return;
    setResult(null);
    setProblem(null);
    if (file === null) {
      setProblem("Choose a CSV file first.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setProblem("The file is over 1 MB. Split it and import the parts one by one.");
      return;
    }
    setImporting(true);
    try {
      const text = await file.text();
      setResult(await call((token) => importListingsCsv(token, text)));
    } catch (error) {
      setProblem(
        error instanceof ApiError && error.detail && error.status < 500 // a server error's text is not for the admin
          ? error.detail
          : "We couldn't import the file. Check your connection and try again.",
      );
    } finally {
      setImporting(false);
    }
  }

  async function download(type: "listings" | "checks") {
    if (downloading) return;
    setExportProblem(null);
    setDownloading(true);
    try {
      const text = await call((token) => exportCsv(token, type));
      const address = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = address;
      link.download = `${type}.csv`;
      link.click();
      URL.revokeObjectURL(address);
    } catch {
      setExportProblem("We couldn't download the file. Check your connection and try again.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6">
      <h1 className="text-2xl font-bold text-forest">Import and export</h1>

      <section aria-labelledby="import-heading" className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4">
        <h2 id="import-heading" className="text-xl font-bold text-forest">Import listings</h2>
        <p className="text-base text-ink">Columns: {COLUMNS}. Row 1 is the header. Up to 500 rows and 1 MB. Each good row becomes a draft; a row with a problem is skipped and listed below.</p>
        <div className="flex flex-col gap-1">
          <label htmlFor="csv-file" className="text-base font-semibold text-ink">CSV file</label>
          <input
            id="csv-file"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setResult(null);
              setProblem(null);
            }}
            className="min-h-12 w-full rounded-xl border border-line bg-white p-3 text-base text-ink"
          />
        </div>
        <button type="button" onClick={() => void runImport()} disabled={importing} className={`${buttonClasses("primary")} disabled:opacity-60`}>
          <DecorativeIcon icon={Upload} />
          {importing ? "Importing…" : "Import"}
        </button>
        {problem && (
          <p role="alert" className="rounded-2xl border border-line bg-amber-wash p-4 text-base font-semibold text-amber-ink">{problem}</p>
        )}
        {result && (
          <div className="flex flex-col gap-2">
            <p role="status" className="text-base font-semibold text-ink">
              {result.created} {result.created === 1 ? "listing was" : "listings were"} created as {result.created === 1 ? "a draft" : "drafts"}.
            </p>
            {result.errors.length > 0 && (
              <>
                <p className="text-base text-ink">These rows were skipped:</p>
                <ul aria-label="Skipped rows" className="list-disc pl-5 text-base text-ink">
                  {result.errors.map((error) => (
                    <li key={`${error.row}-${error.detail}`}>{`Row ${error.row}: ${error.detail}`}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </section>

      <section aria-labelledby="export-heading" className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4">
        <h2 id="export-heading" className="text-xl font-bold text-forest">Export</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => void download("listings")} disabled={downloading} className={`${buttonClasses("secondary")} disabled:opacity-60`}>
            <DecorativeIcon icon={Download} />
            Download listings (CSV)
          </button>
          <button type="button" onClick={() => void download("checks")} disabled={downloading} className={`${buttonClasses("secondary")} disabled:opacity-60`}>
            <DecorativeIcon icon={Download} />
            Download verification checks (CSV)
          </button>
        </div>
        {exportProblem && (
          <p role="alert" className="rounded-2xl border border-line bg-amber-wash p-4 text-base font-semibold text-amber-ink">{exportProblem}</p>
        )}
      </section>
    </section>
  );
}
