/** The two small client parts every public page carries: the service worker (and its "new version" message) and the listener for the
 * browser's install event. Requirements: NFR-03, NFR-04. Spec: specs/2026-11-02-installable-pwa/. Placed by the layouts of the home page and
 * of the public pages; not by the dashboards (the admin and provider screens), which the worker never keeps anyway. Draws no
 * element of its own (the update message appears only when there is a new version).
 */
import { RegisterServiceWorker } from "@/components/offline/RegisterServiceWorker";
import { InstallPromptListener } from "@/components/pwa/InstallPromptListener";

export function PublicPwa() {
  return (
    <>
      <RegisterServiceWorker />
      <InstallPromptListener />
    </>
  );
}
