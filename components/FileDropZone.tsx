"use client";

import { useCallback, useRef, useState } from "react";

interface FileDropZoneProps {
  onFileSelected: (file: File) => void;
  selectedFileName?: string | null;
}

export function FileDropZone({
  onFileSelected,
  selectedFileName,
}: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) onFileSelected(file);
    },
    [onFileSelected]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      style={{
        borderColor: isDragging
          ? "var(--accent)"
          : selectedFileName
          ? "var(--positive)"
          : "var(--hairline)",
        backgroundColor: isDragging
          ? "rgba(45, 212, 191, 0.05)"
          : selectedFileName
          ? "rgba(52, 194, 154, 0.05)"
          : "transparent",
      }}
      className="rounded-xl border-2 border-dashed cursor-pointer
        flex flex-col items-center justify-center gap-4
        py-16 px-6 text-center transition-all duration-200"
    >
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.tsv,.txt,.xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileSelected(file);
        }}
      />

      {/* Icon */}
      <div
        style={{
          color: selectedFileName
            ? "var(--positive)"
            : "var(--text-muted)",
        }}
      >
        {selectedFileName ? (
          // Checkmark icon when file selected
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75M21 
              12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        ) : (
          // Upload arrow icon by default
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 
              21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5
              -9L12 3m0 0l4.5 4.5M12 3v13.5"
            />
          </svg>
        )}
      </div>

      {/* Text */}
      {selectedFileName ? (
        <div>
          <p className="font-medium text-sm"
            style={{ color: "var(--positive)" }}>
            {selectedFileName}
          </p>
          <p className="text-text-muted text-xs mt-1">
            Click to choose a different file
          </p>
        </div>
      ) : (
        <div>
          <p className="font-medium text-sm text-text-primary">
            Drop your catalog file here, or click to browse
          </p>
          <p className="text-text-muted text-xs mt-2">
            Accepts .csv, .xlsx, and .tsv files
          </p>
        </div>
      )}
    </div>
  );
}