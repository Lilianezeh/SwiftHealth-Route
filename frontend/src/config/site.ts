/** Site-wide constants: names, the first city, and the navigation links used across the app.
 * UI spec, "Layout" and 2.1 (the header, the footer and the home page were redesigned on 2026-10-11).
 * The names themselves are written once, in config/brand.ts (the owner renamed the app on 2026-10-13).
 */
import { brand } from "@/config/brand";

export const siteConfig = {
  name: brand.name,
  emergencyName: brand.emergencyName,
  tagline: "Emergency, Hospital & Pharmacy Finder",
  // The first city. SwiftHealth is for all of Nigeria and starts here. The home page and its page description name no city
  // (owner, 2026-10-12), but the constant stays for other parts of the app; no text may say "Enugu only".
  launchCity: "Enugu",
  // The address shown on the Contact page. Empty until the owner gives one (never made up); then a mailto link shows. Decision D2 in
  // specs/2026-10-20-info-pages/requirements.md.
  contactEmail: "",
  // The production address, for the sitemap (decision D7). The repo and the Netlify address keep the old name.
  siteUrl: "https://swifthealth-ng.netlify.app",
  copyrightYear: 2026, // a constant, not the clock: the footer is static and says the year of the site's launch
  // The header bar from tablet width: Find care, then the red SwiftRescue, then For facilities.
  findCareLink: { label: "Find care", href: "/find" },
  emergencyLink: { label: brand.emergencyName, href: "/emergency" },
  facilitiesLink: { label: "For facilities", href: "/for-facilities" },
  // After For facilities: My account, only when a session exists in the tab. Log in and Sign up are NOT in the header or the Menu
  // (owner, 2026-11-02), so visitors do not think they need an account: they are on For facilities (owners) and on the Staff portal
  // page (staff), which the footer links to. `/log-in` keeps its address, so bookmarks still work.
  myAccountLabel: "My account",
  // On a phone the red SwiftRescue button stays in the bar (FR-02); the Menu panel holds the other two, then (MobileMenu itself)
  // My account when a session exists.
  menuLinks: [
    { label: "Find care", href: "/find" },
    { label: "For facilities", href: "/for-facilities" },
  ],
  footerLinks: [
    { label: "About", href: "/about" },
    { label: "How we verify", href: "/how-we-verify" },
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
    { label: "Contact", href: "/contact" },
    { label: "List your facility", href: "/list-your-facility" },
    // The small last link: the way to Log in and Sign up as staff (owner, 2026-11-02). Not in the header.
    { label: "Staff portal", href: "/staff-portal" },
  ],
};
