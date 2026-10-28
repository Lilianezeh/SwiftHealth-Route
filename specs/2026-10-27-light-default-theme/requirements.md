# Light is the default theme: requirements

Requirement: NFR-10 (readable, consistent screens). Owner's request of 2026-10-27. Parent feature: `specs/2026-10-27-dark-mode/`.

## Why
The first dark mode (pull request #69) follows the device by default, so a visitor whose phone is dark now gets a dark site that the owner does not yet approve of. Until the owner approves the new dark mode, everyone starts in Light.

## Rules
1. With nothing chosen, the site is **Light**, even when the device is dark, and also with no script.
2. **Dark** comes only when the visitor picks it with the Theme button. The button keeps its three choices, in the same order: Light, Dark, System.
3. **System** stays in the button. It is the only choice that follows the device, and it keeps following it while the page is open.
4. All three choices are remembered in the browser under the same key, `swifthealth.theme`, as `light`, `dark` or `system`. System has to be kept too: without it, System could not be told from never having chosen, which is Light. Any other stored value counts as Light.
5. Nothing is kept for a visitor who never pressed the button.
6. The theme is still set before the first paint (no flash). The browser's own parts (fields, scrollbars) follow the page, never the device (`color-scheme: light` unless the page is dark).
7. **No light-mode colour changes.** Only the choosing of the theme changes; no token value changes.

## Not in this change
- The new dark palette, the dark hero and the dark home sections: they wait for the owner's choice between two palette options (a separate pull request).
- A visitor who had pressed the button to System before this change (that used to keep nothing) is now Light until they press it again. This is the intended effect of "Light for everyone".

## Owner steps
None. No migration, no setting on Render or Netlify.
