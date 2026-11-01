"use client";

/** Editing a saved request: a draft, or a request that staff asked to change. Requirements: US-17, FR-50, FR-23, NFR-06, NFR-10.
 * Spec: specs/2026-11-01-owner-form-fields/; UI spec 2.9. It loads the request with `GET /provider/requests/{link_id}` (404 for a
 * request that is not the caller's), and shows the owner form filled with it. A request that is waiting for payment, for our team or
 * already approved cannot be changed here; the API refuses it too (409), so the form is not shown for it.
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useStaff } from "@/components/admin/StaffGate";
import { RegisterFacility } from "@/components/facility/RegisterFacility";
import { buttonClasses } from "@/components/ui/buttonStyles";
import { getFacilityRequest, type SavedRequest } from "@/lib/api/facility";
import { ApiError } from "@/lib/api/request";

const EDITABLE = ["draft", "changes_requested"];

type State = { kind: "loading" } | { kind: "missing" } | { kind: "failed" } | { kind: "ready"; saved: SavedRequest };

export function EditRequest({ linkId }: { linkId: number }) {
  const { call } = useStaff();
  const [state, setState] = useState<State>({ kind: "loading" });

  const load = useCallback(() => {
    setState({ kind: "loading" });
    call((token) => getFacilityRequest(token, linkId))
      .then((saved) => setState({ kind: "ready", saved }))
      .catch((error: unknown) => setState({ kind: error instanceof ApiError && error.status === 404 ? "missing" : "failed" }));
  }, [call, linkId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-bold text-forest">Edit your request</h1>
      {state.kind === "loading" && <p className="text-base text-ink">Loading your request…</p>}
      {state.kind === "missing" && (
        <>
          <p className="text-base text-ink">We could not find this request.</p>
          <Link href="/provider" className={buttonClasses("secondary")}>Go to My facilities</Link>
        </>
      )}
      {state.kind === "failed" && (
        <>
          <p role="alert" className="text-base font-semibold text-amber-ink">We could not load this request. Check your connection and try again.</p>
          <button type="button" onClick={load} className={buttonClasses("secondary")}>Try again</button>
        </>
      )}
      {state.kind === "ready" && !EDITABLE.includes(state.saved.status) && (
        <>
          <p className="text-base text-ink">This request cannot be changed now. It is with our team, or it is already approved.</p>
          <Link href="/provider" className={buttonClasses("secondary")}>Go to My facilities</Link>
        </>
      )}
      {state.kind === "ready" && EDITABLE.includes(state.saved.status) && <RegisterFacility call={call} saved={state.saved} />}
    </section>
  );
}
