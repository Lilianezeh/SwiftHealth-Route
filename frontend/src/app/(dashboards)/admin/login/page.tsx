/** The staff login `/admin/login`. Requirements: FR-30, FR-42. UI spec 3.1. A server page that only holds the form (a client
 * component). It is not linked from the header or the footer: staff open it by address. */
import { LoginForm } from "@/components/admin/LoginForm";

export default function AdminLoginPage() {
  return <LoginForm />;
}
