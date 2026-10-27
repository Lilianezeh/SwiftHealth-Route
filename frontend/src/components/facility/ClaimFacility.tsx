"use client";

/** "Find and claim your facility", for a logged-in provider. Requirements: FR-50, FR-51, NFR-06, NFR-07, NFR-10. UI spec 2.9;
 * api-spec section 7, "Phase 7". A search (after a short pause, two letters or more) lists published facilities by name, area and
 * category only; "Claim" opens a small form (role and a short reason) and the request goes to staff, who phone the facility. A 409
 * shows the API's own sentence. Nothing is kept in the browser and no position is asked for.
 */
import { useEffect, useState, type FormEvent } from "react";

import { buttonClasses } from "@/components/ui/buttonStyles";
import { claimFacility, findClaimableFacilities, type ClaimableFacility, type FacilityRole } from "@/lib/api/facility";
import { ApiError } from "@/lib/api/request";

const FIELD = "min-h-12 w-full rounded-xl border border-line bg-white px-3 text-base text-ink";
const CHOICE = "flex min-h-12 items-center gap-3 text-base text-ink";
const MAX_REASON = 300;
const SEARCH_PAUSE_MS = 300;
const MIN_SEARCH_LENGTH = 2;

type Target = { id: number; name: string };

type Props = {
  call: <T>(operation: (token: string) => Promise<T>) => Promise<T>;
  /** A facility to claim from the start (the person was told it is already listed). */
  initialTarget?: Target | null;
};

export function ClaimFacility({ call, initialTarget = null }: Props) {
  const [searchText, setSearchText] = useState("");
  const [results, setResults] = useState<ClaimableFacility[] | null>(null);
  const [searchProblem, setSearchProblem] = useState<string | null>(null);
  const [target, setTarget] = useState<Target | null>(initialTarget);
  const [role, setRole] = useState<FacilityRole>("owner");
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [thanks, setThanks] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = searchText.trim();
    if (trimmed.length < MIN_SEARCH_LENGTH) {
      setResults(null);
      setSearchProblem(null);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      call((token) => findClaimableFacilities(token, trimmed, controller.signal))
        .then((found) => {
          setResults(found);
          setSearchProblem(null);
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setSearchProblem(
            error instanceof ApiError && error.status === 429
              ? "You've searched many times. Please try again later."
              : "We couldn't search. Check your connection and try again.",
          );
        });
    }, SEARCH_PAUSE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchText, call]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending || target === null) return;
    if (reason.trim().length < 3) {
      setProblem("Write a few words about how you are connected to this facility.");
      return;
    }
    setSending(true);
    setProblem(null);
    try {
      const answer = await call((token) => claimFacility(token, { listing_id: target.id, role, reason }));
      setReason("");
      setThanks(answer.message);
    } catch (error) {
      if (error instanceof ApiError && (error.status === 409 || error.status === 404) && error.detail) setProblem(error.detail);
      else if (error instanceof ApiError && error.status === 429) setProblem("You've sent several requests. Please try again tomorrow.");
      else if (error instanceof ApiError && error.status === 422) setProblem("Check the form: one of the answers is not accepted.");
      else if (!(error instanceof ApiError && error.status === 401)) setProblem("We couldn't send the request. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  if (thanks) {
    return (
      <section aria-labelledby="claim-heading" className="flex flex-col gap-3">
        <h2 id="claim-heading" className="text-xl font-bold text-forest">Find and claim your facility</h2>
        <p role="status" className="rounded-2xl border border-line bg-pine-50 p-4 text-lg text-ink">{thanks}</p>
      </section>
    );
  }

  return (
    <section id="claim-section" aria-labelledby="claim-heading" className="flex flex-col gap-4">
      <h2 id="claim-heading" className="text-xl font-bold text-forest">Find and claim your facility</h2>
      <p className="text-base text-ink">Already listed? Search for it and ask to manage it. Our team phones the facility to check.</p>
      {target === null ? (
        <>
          <div className="flex flex-col gap-1">
            <label htmlFor="claim-search" className="text-base font-semibold text-ink">Facility name or area</label>
            <input id="claim-search" type="search" autoComplete="off" value={searchText} onChange={(event) => setSearchText(event.target.value)} className={FIELD} />
          </div>
          {searchProblem && <p role="alert" className="rounded-2xl border border-line bg-amber-wash p-4 text-base font-semibold text-amber-ink">{searchProblem}</p>}
          {results !== null && results.length === 0 && !searchProblem && (
            <p className="text-base text-ink">No facility found. Check the spelling, or register it as a new facility above.</p>
          )}
          {results !== null && results.length > 0 && (
            <ul className="flex flex-col gap-3">
              {results.map((facility) => (
                <li key={facility.id} className="flex flex-col gap-2 rounded-2xl border border-line bg-white p-4">
                  <p className="text-lg font-bold text-forest">{facility.name}</p>
                  <p className="text-base text-ink-soft">{`${facility.category.name}, ${facility.area}`}</p>
                  <button
                    type="button"
                    onClick={() => setTarget({ id: facility.id, name: facility.name })}
                    aria-label={`Claim ${facility.name}`}
                    className={buttonClasses("secondary")}
                  >
                    Claim
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <form onSubmit={send} noValidate className="flex flex-col gap-4">
          <p className="text-lg font-bold text-forest">{target.name}</p>
          <fieldset className="flex flex-col">
            <legend className="text-base font-semibold text-ink">Your role</legend>
            <label className={CHOICE}>
              <input type="radio" name="claim-role" value="owner" checked={role === "owner"} onChange={() => setRole("owner")} className="size-5" />
              I own it
            </label>
            <label className={CHOICE}>
              <input type="radio" name="claim-role" value="manager" checked={role === "manager"} onChange={() => setRole("manager")} className="size-5" />
              I manage it
            </label>
          </fieldset>
          <div className="flex flex-col gap-1">
            <label htmlFor="claim-reason" className="text-base font-semibold text-ink">How are you connected to this facility?</label>
            <textarea id="claim-reason" rows={3} maxLength={MAX_REASON} value={reason} onChange={(event) => setReason(event.target.value)} className="w-full rounded-xl border border-line bg-white p-3 text-base text-ink" />
          </div>
          {problem && <p role="alert" className="rounded-2xl border border-line bg-amber-wash p-4 text-base font-semibold text-amber-ink">{problem}</p>}
          <button type="submit" disabled={sending} className={`${buttonClasses("primary")} disabled:opacity-60`}>
            {sending ? "Sending…" : "Send request"}
          </button>
          <button type="button" onClick={() => { setTarget(null); setProblem(null); }} className={buttonClasses("secondary")}>
            Choose another facility
          </button>
        </form>
      )}
    </section>
  );
}
