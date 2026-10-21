/** "List your facility" `/list-your-facility`. Requirements: FR-37, FR-23. UI spec 2.9. A server page holding the form (a client
 * component); the form's lists come from GET /meta in the browser. */
import type { Metadata } from "next";

import { FacilityForm } from "@/components/facility/FacilityForm";

export const metadata: Metadata = {
  title: "List your facility",
  description: "Send your facility's details for our team to verify. Listing is free during our launch.",
};

export default function ListYourFacilityPage() {
  return <FacilityForm />;
}
