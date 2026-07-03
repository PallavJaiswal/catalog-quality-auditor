"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileDropZone } from "@/components/FileDropZone";
import { ColumnMappingModal } from "@/components/ColumnMappingModal";
import { generateSampleCatalog } from "@/lib/sampleData";
import { parseFile, guessMapping, applyMapping } from "@/lib/parsing";
import type { ParsedFile } from "@/lib/parsing";
import { useAppData, PIPELINE_STAGES } from "@/lib/store";
import type { RawCatalogRow, ColumnMapping } from "@/lib/types";

export default function UploadPage() {
  const router = useRouter();
  const { stage, error, runAudit, reset } = useAppData();

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);
  const [isSampleLoaded, setIsSampleLoaded] = useState(false);
  const [rows, setRows] =
    useState<RawCatalogRow[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(
    null
  );
  const [parsedFile, setParsedFile] = useState<ParsedFile | null>(
    null
  );
  const [pendingMapping, setPendingMapping] =
    useState<ColumnMapping | null>(null);
  const [showMappingModal, setShowMappingModal] = useState(false);

  const isProcessing =
    stage !== "idle" &&
    stage !== "done" &&
    stage !== "error";

  // Redirect to dashboard when pipeline finishes
  useEffect(() => {
    if (stage === "done") {
      router.push("/dashboard");
    }
  }, [stage, router]);

  // Reset store when landing on upload page
  useEffect(() => {
    reset();
  }, [reset]);

  async function handleFile(file: File) {
    setParseError(null);
    setIsSampleLoaded(false);
    setRows(null);
    try {
      const parsed = await parseFile(file);
      setSelectedFile(file);
      setParsedFile(parsed);
      // Auto-detect which column is which, then let the user
      // confirm (or fix) the guess before we run the audit —
      // real-world files rarely use our exact field names.
      setPendingMapping(guessMapping(parsed.headers));
      setShowMappingModal(true);
    } catch (err) {
      setParseError((err as Error).message);
    }
  }

  function handleConfirmMapping(mapping: ColumnMapping) {
    if (!parsedFile) return;
    const mapped = applyMapping(parsedFile.rows, mapping);
    setRows(mapped);
    setShowMappingModal(false);
  }

  function handleCancelMapping() {
    setShowMappingModal(false);
    setSelectedFile(null);
    setParsedFile(null);
    setPendingMapping(null);
  }

  function handleLoadSample() {
    setSelectedFile(null);
    setParseError(null);
    setIsSampleLoaded(true);
    setShowMappingModal(false);
    setParsedFile(null);
    setPendingMapping(null);
    setRows(generateSampleCatalog());
  }

  async function handleRunAudit() {
    if (!rows || rows.length === 0) return;
    const filename = selectedFile?.name ?? "sample-catalog.csv";
    await runAudit(rows, filename);
  }

  const hasData = rows !== null && rows.length > 0;

  return (
    <div className="min-h-screen flex flex-col">

      {/* Page header */}
      <div className="border-b border-hairline px-8 py-5">
        <div className="max-w-3xl mx-auto">
          <p className="mono-label text-accent mb-1">
            Step 1 of 1
          </p>
          <h1 className="text-xl font-semibold text-text-primary">
            Upload your catalog file
          </h1>
          <p className="text-text-muted text-sm mt-1">
            Supports .csv, .xlsx, and .tsv — we will automatically
            check for missing fields, duplicates, and SEO issues.
          </p>
        </div>
      </div>

      {/* Page body */}
      <div className="flex-1 px-8 py-10">
        <div className="max-w-3xl mx-auto flex flex-col gap-6">

          {/* Processing state */}
          {isProcessing && (
            <div className="rounded-xl border border-hairline
              bg-panel p-8 flex flex-col items-center gap-8">

              <div>
                <p className="mono-label text-accent text-center
                  mb-1">
                  Running audit pipeline
                </p>
                <p className="text-text-muted text-sm text-center">
                  Analyzing {rows?.length ?? 0} listings...
                </p>
              </div>

              {/* Pipeline steps */}
              <div className="w-full flex flex-col gap-3">
                {PIPELINE_STAGES.map((s, i) => {
                  const stageIndex = PIPELINE_STAGES
                    .findIndex((p) => p.key === stage);
                  const currentIndex = i;
                  const isDone = currentIndex < stageIndex;
                  const isActive = s.key === stage;

                  return (
                    <div
                      key={s.key}
                      className="flex items-center gap-3"
                    >
                      {/* Status indicator */}
                      <div
                        className="w-6 h-6 rounded-full flex
                          items-center justify-center shrink-0
                          text-xs font-mono transition-all"
                        style={{
                          backgroundColor: isDone
                            ? "var(--positive)"
                            : isActive
                            ? "var(--accent)"
                            : "var(--panel-raised)",
                          color: isDone || isActive
                            ? "var(--ink)"
                            : "var(--text-muted)",
                        }}
                      >
                        {isDone ? "✓" : i + 1}
                      </div>

                      {/* Stage label */}
                      <span
                        className="text-sm transition-colors"
                        style={{
                          color: isDone
                            ? "var(--positive)"
                            : isActive
                            ? "var(--text-primary)"
                            : "var(--text-muted)",
                          fontWeight: isActive ? 500 : 400,
                        }}
                      >
                        {s.label}
                      </span>

                      {/* Active pulse */}
                      {isActive && (
                        <div
                          className="w-1.5 h-1.5 rounded-full
                            animate-pulse"
                          style={{
                            backgroundColor: "var(--accent)",
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Upload UI — hidden while processing */}
          {!isProcessing && (
            <>
              {/* Drop zone or sample confirmation */}
              {!isSampleLoaded ? (
                <FileDropZone
                  onFileSelected={handleFile}
                  selectedFileName={selectedFile?.name ?? null}
                />
              ) : (
                <div
                  className="rounded-xl border-2 border-dashed
                    py-16 px-6 flex flex-col items-center gap-3"
                  style={{ borderColor: "var(--positive)" }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="40" height="40"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--positive)"
                    strokeWidth="1.5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12.75L11.25 15 15 9.75M21 12a9 
                      9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p
                    className="font-medium text-sm"
                    style={{ color: "var(--positive)" }}
                  >
                    Sample catalog loaded — 12 listings ready
                  </p>
                  <button
                    onClick={() => {
                      setIsSampleLoaded(false);
                      setRows(null);
                    }}
                    className="text-xs text-text-muted
                      hover:text-text-primary transition-colors"
                  >
                    Upload a real file instead
                  </button>
                </div>
              )}

              {/* Parse error */}
              {parseError && (
                <div
                  className="rounded-lg px-4 py-3 text-sm"
                  style={{
                    backgroundColor: "rgba(248,81,73,0.1)",
                    color: "var(--negative)",
                    border: "1px solid rgba(248,81,73,0.3)",
                  }}
                >
                  {parseError}
                </div>
              )}

              {/* Divider */}
              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-hairline" />
                <span className="mono-label text-text-muted">
                  or
                </span>
                <div className="flex-1 h-px bg-hairline" />
              </div>

              {/* Sample dataset button */}
              <button
                onClick={handleLoadSample}
                className="w-full rounded-xl border border-hairline
                  bg-panel hover:border-accent transition-colors
                  px-6 py-4 flex items-center justify-center
                  gap-3 text-sm font-medium text-text-primary"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18" height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="1.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.813 15.904L9 18.75l-.813-2.846a4.5 
                    4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 
                    4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 
                    4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 
                    4.5 0 00-3.09 3.09z"
                  />
                </svg>
                Load sample catalog
                <span className="text-text-muted font-normal">
                  (12 listings with deliberate issues for demo)
                </span>
              </button>

              {/* Run Audit button */}
              {hasData && (
                <button
                  onClick={handleRunAudit}
                  className="w-full rounded-xl py-4 px-6
                    font-semibold text-sm transition-opacity
                    hover:opacity-90"
                  style={{
                    backgroundColor: "var(--accent)",
                    color: "var(--ink)",
                  }}
                >
                  Run Audit → {rows.length} listings
                </button>
              )}
            </>
          )}

          {/* Error state */}
          {stage === "error" && error && (
            <div
              className="rounded-lg px-4 py-3 text-sm"
              style={{
                backgroundColor: "rgba(248,81,73,0.1)",
                color: "var(--negative)",
                border: "1px solid rgba(248,81,73,0.3)",
              }}
            >
              {error}
            </div>
          )}

        </div>
      </div>

      {showMappingModal && parsedFile && pendingMapping && (
        <ColumnMappingModal
          headers={parsedFile.headers}
          initialMapping={pendingMapping}
          onConfirm={handleConfirmMapping}
          onCancel={handleCancelMapping}
        />
      )}
    </div>
  );
}