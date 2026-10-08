/** API client: the only place the frontend calls the backend. Components never call fetch directly. */
import type { HealthResponse } from "@/types/api";

const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
// Inside Docker, the server-side code reaches the backend by its service name.
const SERVER_API_URL = process.env.API_URL_INTERNAL ?? PUBLIC_API_URL;

// The free Render API sleeps when idle and takes about a minute to wake, but the hosting gives up on a page after
// about 30 seconds. So we stop waiting early and show "not reachable"; the request still wakes the API for the next visit.
const HEALTH_TIMEOUT_MS = 8000;

export async function getHealth(timeoutMs: number = HEALTH_TIMEOUT_MS): Promise<HealthResponse | null> {
  try {
    const response = await fetch(`${SERVER_API_URL}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

export { PUBLIC_API_URL };
