/** "List your facility" `/list-your-facility`. Requirements: FR-37, FR-23. UI spec 2.9. A server page holding the form (a client
 * component); the form's lists come from GET /meta in the browser. */
import { FacilityForm } from "@/components/facility/FacilityForm";

export default function ListYourFacilityPage() {
  return <FacilityForm />;
}
