/** Reloads the page. Its own file so a test can replace it (a page cannot reload itself inside jsdom). Spec: specs/2026-11-02-installable-pwa/. */
export function reloadPage(): void {
  window.location.reload();
}
