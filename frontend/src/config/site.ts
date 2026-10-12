/** Site-wide constants: names, the first city, and the navigation links used across the app.
 * UI spec, "Layout" and 2.1 (the header, the footer and the home page were redesigned on 2026-10-11).
 */
export const siteConfig = {
  name: "SwiftHealth",
  emergencyName: "SwiftRescue",
  tagline: "Emergency, Hospital & Pharmacy Finder",
  // The first city. SwiftHealth is for all of Nigeria and starts here. The home page and its page description name no city
  // (owner, 2026-10-12), but the constant stays for other parts of the app; no text may say "Enugu only".
  launchCity: "Enugu",
  copyrightYear: 2026, // a constant, not the clock: the footer is static and says the year of the site's launch
  // The header bar from tablet width: Find care, then the red SwiftRescue, then For facilities.
  findCareLink: { label: "Find care", href: "/find" },
  emergencyLink: { label: "SwiftRescue", href: "/emergency" },
  facilitiesLink: { label: "For facilities", href: "/list-your-facility" },
  // On a phone the red SwiftRescue button stays in the bar (FR-02); the Menu panel holds the other two.
  menuLinks: [
    { label: "Find care", href: "/find" },
    { label: "For facilities", href: "/list-your-facility" },
  ],
  footerLinks: [
    { label: "About", href: "/about" },
    { label: "How we verify", href: "/how-we-verify" },
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
    { label: "Contact", href: "/contact" },
    { label: "List your facility", href: "/list-your-facility" },
  ],
};
