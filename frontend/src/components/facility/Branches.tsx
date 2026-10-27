"use client";

/** "Branches" of a main facility, on "Edit my facility". Requirements: FR-52, US-20, NFR-10. UI spec 3.12; api-spec 7, "Phase 8b".
 * Lists the branches with their status in words and an Edit link to each, and a form "Add a branch": name, area, address, phone and
 * notes. The branch takes the main facility's category and is a draft that staff verify. The API's sentence is shown when it refuses
 * (already registered, a rule). Nothing is kept in the browser and no position is asked for.
 */
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { buttonClasses } from "@/components/ui/buttonStyles";
import { useMeta } from "@/hooks/useMeta";
import { addBranch, listBranches, type BranchItem } from "@/lib/api/listingChanges";
import { ApiError } from "@/lib/api/request";
import { toE164 } from "@/lib/formatters/phone";

const FIELD = "min-h-12 w-full rounded-xl border border-line bg-white px-3 text-base text-ink";
const SECTION = "flex flex-col gap-3 rounded-2xl border border-line bg-white p-4";
const MAX_NOTES = 300;
const STATUS_WORDS: Record<string, string> = {
  draft: "Waiting for our team to verify it",
  pending_review: "Waiting for review",
  published: "Listed",
  recheck_due: "Waiting for a re-check",
  hidden: "Hidden",
};

type Form = { facility_name: string; area: string; address: string; phone: string; notes: string };
const EMPTY: Form = { facility_name: "", area: "", address: "", phone: "", notes: "" };

function problemsOf(form: Form): string[] {
  const problems: string[] = [];
  if (form.facility_name.trim().length < 2) problems.push("Enter the branch name.");
  if (form.area === "") problems.push("Choose an area.");
  if (form.address.trim().length < 3) problems.push("Enter the address.");
  if (toE164(form.phone.trim()) === null) problems.push("Check the phone number. It should look like 0803 123 4567.");
  return problems;
}

type Props = {
  mainId: number;
  call: <T>(operation: (token: string) => Promise<T>) => Promise<T>;
};

export function Branches({ mainId, call }: Props) {
  const { meta } = useMeta();
  const [branches, setBranches] = useState<BranchItem[] | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [problems, setProblems] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [thanks, setThanks] = useState<string | null>(null);

  const load = useCallback(() => {
    call((token) => listBranches(token, mainId))
      .then(setBranches)
      .catch(() => setBranches(null));
  }, [call, mainId]);

  useEffect(load, [load]);

  const set = (key: keyof Form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    const found = problemsOf(form);
    if (found.length > 0) {
      setProblems(found);
      return;
    }
    setSending(true);
    setProblems([]);
    setThanks(null);
    try {
      const answer = await call((token) => addBranch(token, mainId, form));
      setForm(EMPTY);
      setThanks(answer.message);
      load();
    } catch (error) {
      if (error instanceof ApiError && (error.status === 409 || error.status === 422 || error.status === 404) && typeof error.detail === "string") {
        setProblems([error.detail]);
      } else if (error instanceof ApiError && error.status === 429) {
        setProblems(["You've added several branches. Please try again tomorrow."]);
      } else if (error instanceof ApiError && error.status === 422) {
        setProblems(["Check the form: one of the answers is not accepted."]);
      } else {
        setProblems(["We couldn't send the form. Check your connection and try again."]);
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <section aria-labelledby="branches-heading" className="flex flex-col gap-4">
      <h2 id="branches-heading" className="text-xl font-bold text-forest">Branches</h2>

      {branches !== null && branches.length === 0 && <p className="text-base text-ink">No branches yet.</p>}
      {branches !== null && branches.length > 0 && (
        <ul className="flex flex-col gap-3">
          {branches.map((branch) => (
            <li key={branch.id} className={SECTION}>
              <p className="text-lg font-bold text-forest">{branch.name}</p>
              <p className="text-base text-ink-soft">{`${branch.area} · ${STATUS_WORDS[branch.status] ?? branch.status}`}</p>
              <Link href={`/provider/edit?listing=${branch.id}`} className={buttonClasses("secondary")} aria-label={`Edit ${branch.name}`}>
                Edit
              </Link>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={send} noValidate aria-labelledby="add-branch-heading" className={SECTION}>
        <h3 id="add-branch-heading" className="text-lg font-bold text-forest">Add a branch</h3>
        <div className="flex flex-col gap-1">
          <label htmlFor="branch-name" className="text-base font-semibold text-ink">Branch name</label>
          <input id="branch-name" value={form.facility_name} onChange={(event) => set("facility_name", event.target.value)} className={FIELD} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="branch-area" className="text-base font-semibold text-ink">Branch area</label>
          <select id="branch-area" value={form.area} onChange={(event) => set("area", event.target.value)} className={FIELD}>
            <option value="">Choose an area</option>
            {meta?.areas.map((area) => (
              <option key={area} value={area}>{area}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="branch-address" className="text-base font-semibold text-ink">Branch address</label>
          <input id="branch-address" value={form.address} onChange={(event) => set("address", event.target.value)} className={FIELD} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="branch-phone" className="text-base font-semibold text-ink">Branch phone number</label>
          <input id="branch-phone" inputMode="tel" autoComplete="off" value={form.phone} onChange={(event) => set("phone", event.target.value)} className={FIELD} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="branch-notes" className="text-base font-semibold text-ink">Notes (optional)</label>
          <textarea id="branch-notes" rows={2} maxLength={MAX_NOTES} value={form.notes} onChange={(event) => set("notes", event.target.value)} className="w-full rounded-xl border border-line bg-white p-3 text-base text-ink" />
        </div>
        {problems.length > 0 && (
          <div role="alert" className="rounded-2xl border border-line bg-amber-wash p-4 text-base font-semibold text-amber-ink">
            <ul className="list-disc pl-5">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </div>
        )}
        {thanks && <p role="status" className="text-base font-semibold text-ink">{thanks}</p>}
        <button type="submit" disabled={sending} className={`${buttonClasses("primary")} disabled:opacity-60`}>
          {sending ? "Sending…" : "Send"}
        </button>
      </form>
    </section>
  );
}
