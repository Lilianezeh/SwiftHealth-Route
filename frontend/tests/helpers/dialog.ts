/** jsdom does not know `showModal()` and `close()` of the native <dialog> element. This gives it the two that matter for
 * our tests: showModal() sets the `open` attribute, and close() removes it and sends the `close` event, as a browser does.
 * (Esc, the backdrop and focus return are done by the browser itself and are checked by hand in the smoke test.)
 */
export function installDialogSupport(): void {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute("open")) return;
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}
