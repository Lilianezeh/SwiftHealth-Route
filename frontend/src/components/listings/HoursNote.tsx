/** The hours line of a card: a grey clock and the text of the API ("Closes 9:00 PM"). Requirements: FR-06, US-01, NFR-10.
 * UI spec: ListingCard. Decisions in specs/2026-10-10-hours-note-on-card/requirements.md.
 * Nothing at all when there is no note (a 24-hour listing, or no hours recorded): no empty row, no icon.
 * The text is rendered as text (React escapes it) and is not changed here.
 */
import { Clock } from "lucide-react";

import { DecorativeIcon } from "@/components/ui/DecorativeIcon";

type HoursNoteProps = { note: string | null };

export function HoursNote({ note }: HoursNoteProps) {
  const text = note?.trim();
  if (!text) return null;

  return (
    <p className="flex gap-2 text-base text-ink-soft">
      <DecorativeIcon icon={Clock} className="mt-1 h-5 w-5" />
      <span>{text}</span>
    </p>
  );
}
