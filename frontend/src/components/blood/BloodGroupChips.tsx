"use client";

/** The blood group choice of Find blood: "Any" and the eight groups, one pressed at a time. Requirements: FR-27, NFR-10.
 * UI spec 2.6. The groups come from GET /meta in the form pages; here they are the fixed eight of the API
 * (BLOOD_GROUPS in backend/app/core/config.py), so the chips show at once, before any answer.
 */
export const BLOOD_GROUP_CHOICES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

type BloodGroupChipsProps = { selected: string | null; onSelect: (group: string | null) => void };

export function BloodGroupChips({ selected, onSelect }: BloodGroupChipsProps) {
  const choices: { label: string; group: string | null }[] = [
    { label: "Any", group: null },
    ...BLOOD_GROUP_CHOICES.map((group) => ({ label: group, group })),
  ];

  return (
    <div role="group" aria-label="Blood group" className="flex flex-wrap gap-2">
      {choices.map((choice) => {
        const isSelected = choice.group === selected;
        return (
          <button
            key={choice.label}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelect(choice.group)}
            className={`inline-flex min-h-12 min-w-12 items-center justify-center rounded-full border px-4 text-base font-semibold ${
              isSelected ? "border-pine bg-pine text-white" : "border-pine bg-white text-forest"
            }`}
          >
            {choice.label}
          </button>
        );
      })}
    </div>
  );
}
