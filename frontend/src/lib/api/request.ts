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
  /** `detail` is the API's own sentence when it sent one (the staff screens show it), else null.
   * `retryAfterSeconds` is the `Retry-After` header when it is a whole number of seconds (the login code limits), else null. */
  constructor(
    public readonly status: number,
    public readonly detail: string | null = null,
    public readonly retryAfterSeconds: number | null = null,
  ) {
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
  body?: unknown; // sent as JSON; with a body the call is a POST unless `method` says otherwise
  method?: "GET" | "POST" | "PATCH"; // a POST with no body is the staff status buttons
  token?: string; // the staff session's token, sent as `Authorization: Bearer ...` and never in an address
  csvBody?: string; // the text of a CSV file, sent as `text/csv` with a POST (the staff import)
  asText?: boolean; // return the answer as text, not as JSON (the staff CSV export)
};

/** The `detail` sentence of an error answer, if the API sent one as text. */
async function readDetail(response: Response): Promise<string | null> {
  try {
    const body: unknown = await response.json();
    const detail = (body as { detail?: unknown } | null)?.detail;
    return typeof detail === "string" ? detail : null;
  } catch {
    return null;
  }
}

/** The `Retry-After` header as whole seconds. The date form of the header is not used by our API, so it is ignored. */
function readRetryAfter(response: Response): number | null {
  const header = response.headers.get("Retry-After");
  return header !== null && /^\d+$/.test(header.trim()) ? Number(header) : null;
}

export async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { onSlow, signal, slowAfterMs = WAKING_NOTICE_MS, timeoutMs = REQUEST_TIMEOUT_MS, body, token, csvBody, asText } = options;
  const hasBody = body !== undefined;
  const method = options.method ?? (hasBody || csvBody !== undefined ? "POST" : "GET");
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
      ...(method === "GET" ? {} : { method }),
      ...(hasBody ? { body: JSON.stringify(body) } : {}),
      ...(csvBody !== undefined ? { body: csvBody } : {}),
      headers: {
        Accept: asText ? "text/csv" : "application/json",
        ...(hasBody ? { "Content-Type": "application/json" } : {}),
        ...(csvBody !== undefined ? { "Content-Type": "text/csv" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "omit", // the API needs no cookies: the staff token travels in the header
      signal: controller.signal,
    });
    if (!response.ok) throw new ApiError(response.status, await readDetail(response), readRetryAfter(response));
    return (asText ? await response.text() : await response.json()) as T;
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
