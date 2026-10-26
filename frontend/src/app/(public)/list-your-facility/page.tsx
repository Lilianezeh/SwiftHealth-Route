/** "List your facility" `/list-your-facility`. Requirements: FR-37, FR-50, FR-51, FR-23. UI spec 2.9. A server page holding the
 * client part, which shows a visitor the sign-up and log-in buttons and a provider the register and claim forms. */
import type { Metadata } from "next";

import { ListYourFacility } from "@/components/facility/ListYourFacility";

export const metadata: Metadata = {
  title: "List your facility",
  description: "Register your facility or ask to manage a listed one. Listing is free during our launch, and our team verifies every listing.",
};

export default function ListYourFacilityPage() {
  return <ListYourFacility />;
}
