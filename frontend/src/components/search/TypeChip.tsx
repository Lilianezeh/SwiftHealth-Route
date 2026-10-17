"use client";

/** The chip that shows the chosen type under the search box, for example "Pharmacy ✕". Requirements: US-01, FR-05, NFR-10.
 * Spec: specs/2026-10-15-find-by-type/requirements.md D2 and D4. One tap removes the type (the caller replaces the address). The five
 * types have their label in config/types.ts; any other category from a shared link (an emergency one, for example) gets its real
 * name from GET /meta, and the slug itself if even that is not known, so a filtered page never looks unfiltered.
 */
import { X } from "lucide-react";

import { DecorativeIcon } from "@/components/ui/DecorativeIcon";
import { findTypeChoice } from "@/config/types";
import { useMeta } from "@/hooks/useMeta";

type TypeChipProps = { category: string; onRemove: (label: string) => void };
type LabelledChipProps = { label: string; onRemove: (label: string) => void };

function Chip({ label, onRemove }: LabelledChipProps) {
  return (
    <button
      type="button"
      onClick={() => onRemove(label)}
      aria-label={`Remove the ${label} filter`}
      className="inline-flex min-h-12 items-center gap-2 self-start rounded-full border border-pine bg-pine-50 px-4 text-base font-semibold text-forest hover:border-pine-dark hover:bg-pine-100 active:bg-pine-100"
    >
      {label}
      <DecorativeIcon icon={X} />
    </button>
  );
}

/** A category that is not one of the five: its name comes from GET /meta (asked once, kept by getMeta). */
function OtherCategoryChip({ category, onRemove }: TypeChipProps) {
  const { meta } = useMeta();
  const name = meta?.categories.find((item) => item.slug === category)?.name ?? category;
  return <Chip label={name} onRemove={onRemove} />;
}

export function TypeChip({ category, onRemove }: TypeChipProps) {
  const choice = findTypeChoice(category);
  if (choice) return <Chip label={choice.chipLabel} onRemove={onRemove} />;
  return <OtherCategoryChip category={category} onRemove={onRemove} />;
}
