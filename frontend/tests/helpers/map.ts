/** Helpers for the map tests. jsdom has no layout, so every element is 0 × 0 pixels wide, and Leaflet cannot place tiles or
 * fit pins in a map of no size. This gives every element a size, as a phone screen would, until `restoreMapSize()`.
 */
export function stubMapSize(width = 400, height = 300): void {
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => width });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => height });
}

export function restoreMapSize(): void {
  Reflect.deleteProperty(HTMLElement.prototype, "clientWidth");
  Reflect.deleteProperty(HTMLElement.prototype, "clientHeight");
}
