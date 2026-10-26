/** The login for everyone `/log-in`. Requirements: FR-30, FR-48. UI spec 3.1c. A server page that only holds the form (the same client
 * component as `/admin/login`, which keeps its old heading). It sits in the staff-area layout, so search engines skip it. */
import type { Metadata } from "next";

import { LoginForm } from "@/components/admin/LoginForm";

export const metadata: Metadata = { title: "Log in" };

export default function LogInPage() {
  return <LoginForm heading="Log in" showSignUpLink />;
}
