/** One request helper for calls made from the browser. Requirements: US-01, FR-04 (search while the API wakes up).
 *
 * The free API sleeps when idle and takes up to a minute to wake. So the helper tells the caller after 5 seconds
 * (`onSlow`, which the page turns into "The service is waking up") and gives up after 45 seconds. It uses
 * AbortController and setTimeout (not AbortSignal.timeout) so tests can move time with fake timers.
 * Decisions 1 and 2 in specs/2026-10-09-search-frontend/requirements.md.
 */
import { REQUEST_TIMEOUT_MS, WAKING_NOTICE_MS } from "@/config/search";
import { PUBLIC_API_URL } from "@/lib/api/client";

/** The API answered with an error status (404, 422, 500...). */
export class ApiError extends Error {
  constructor(public readonly status: number) {
    super(`The API answered with status ${status}.`);
    this.name = "ApiError";
  }
}

/** No answer within the time limit. */
export class ApiTimeoutError extends Error {
  constructor() {
    super("The API did not answer in time.");
    this.name = "ApiTimeoutError";
  }
}

/** The network failed, or the answer could not be read. */
export class ApiNetworkError extends Error {
  constructor() {
    super("The API could not be reached.");
    this.name = "ApiNetworkError";
  }
}

/** The caller cancelled the request (for example a new search replaced it). Not a failure to show to the visitor. */
export class RequestCancelledError extends Error {
  constructor() {
    super("The request was cancelled.");
    this.name = "RequestCancelledError";
  }
}

export type RequestOptions = {
  onSlow?: () => void; // called once if there is no answer after slowAfterMs
  signal?: AbortSignal; // lets the caller cancel
  slowAfterMs?: number;
  timeoutMs?: number;
  body?: unknown; // sent as JSON with a POST (the report form); without it the call is a GET
};

export async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { onSlow, signal, slowAfterMs = WAKING_NOTICE_MS, timeoutMs = REQUEST_TIMEOUT_MS, body } = options;
  const hasBody = body !== undefined;
  if (signal?.aborted) throw new RequestCancelledError();

  const controller = new AbortController();
  let timedOut = false;
  const cancelWhenCallerCancels = () => controller.abort();
  signal?.addEventListener("abort", cancelWhenCallerCancels, { once: true });
  const slowTimer = onSlow ? setTimeout(onSlow, slowAfterMs) : undefined;
  const timeoutTimer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(`${PUBLIC_API_URL}${path}`, {
      ...(hasBody ? { method: "POST", body: JSON.stringify(body) } : {}),
      headers: { Accept: "application/json", ...(hasBody ? { "Content-Type": "application/json" } : {}) },
      credentials: "omit", // the public API needs no cookies
      signal: controller.signal,
    });
    if (!response.ok) throw new ApiError(response.status);
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (timedOut) throw new ApiTimeoutError();
    if (signal?.aborted) throw new RequestCancelledError();
    throw new ApiNetworkError(); // the message holds no address, so no position can leak into it
  } finally {
    clearTimeout(slowTimer);
    clearTimeout(timeoutTimer);
    signal?.removeEventListener("abort", cancelWhenCallerCancels);
  }
}
