"use client";

/** A list of areas from GET /meta, for a visitor who does not share their position. Requirements: FR-03, NFR-10. */
import { useId } from "react";

import { buttonClasses } from "@/components/ui/buttonStyles";
import { useMeta } from "@/hooks/useMeta";

type AreaSelectProps = { value: string | null; onChange: (area: string) => void };

export function AreaSelect({ value, onChange }: AreaSelectProps) {
  const selectId = useId();
  const { status, meta, retry } = useMeta();

  if (status === "error") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-base text-ink">We couldn&apos;t load the areas. Check your connection and try again.</p>
        <button type="button" onClick={retry} className={buttonClasses("primary")}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={selectId} className="text-base font-semibold text-ink">
        Choose an area
      </label>
      <select
        id={selectId}
        value={value ?? ""}
        disabled={status === "loading"}
        onChange={(event) => {
          if (event.target.value) onChange(event.target.value);
        }}
        className="min-h-[50px] w-full rounded-xl border border-line bg-surface px-3 text-base text-ink"
      >
        <option value="">{status === "loading" ? "Loading areas…" : "Choose an area…"}</option>
        {meta?.areas.map((area) => (
          <option key={area} value={area}>
            {area}
          </option>
        ))}
      </select>
    </div>
  );
}
