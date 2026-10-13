/** The brand: the one place that writes the name of the app. UI spec, "Brand and naming"; revision R35 (2026-10-13) in
 * specs/2026-10-11-home-redesign/requirements.md. The owner renamed the app from SwiftHealth to SwiftHealth Route.
 * Every text on screen (the header logo, the footer, the page title and description, the manifest, the Overview text) takes the
 * name from here, so the next rename is one edit. SwiftRescue, the name of the emergency section and its button, did not change.
 * The repo, the folders and the Netlify address keep the old name on purpose. Check the CAC business name search before buying a
 * domain or printing anything (LOG.md).
 */
export const brand = {
  name: "SwiftHealth Route", // the full name, as one name
  main: "SwiftHealth", // the first part of the wordmark (the logo draws it in navy)
  accent: "Route", // the second part (the logo draws it in blue)
  emergencyName: "SwiftRescue",
} as const;
