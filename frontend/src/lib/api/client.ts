/** API client: the only place the frontend calls the backend. Components never call fetch directly. */
import type { HealthResponse } from "@/types/api";

const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
// Inside Docker, the server-side code reaches the backend by its service name.
const SERVER_API_URL = process.env.API_URL_INTERNAL ?? PUBLIC_API_URL;

export async function getHealth(): Promise<HealthResponse | null> {
  try {
    const response = await fetch(`${SERVER_API_URL}/health`, { cache: "no-store" });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

export { PUBLIC_API_URL };
