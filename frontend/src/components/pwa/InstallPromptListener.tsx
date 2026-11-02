"use client";

/** Starts listening for the browser's install event on every public page. Requirements: NFR-03, NFR-04. Spec: specs/2026-11-02-installable-pwa/.
 * It draws nothing. The listener must be there before the browser sends the event (a few seconds after the page loads), and a Menu that
 * is closed has not drawn its install row yet, so the listening is its own small part (lib/pwa/installPrompt.ts keeps the event).
 */
import { useEffect } from "react";

import { listenForInstallPrompt } from "@/lib/pwa/installPrompt";

export function InstallPromptListener() {
  useEffect(() => listenForInstallPrompt(), []);
  return null;
}
