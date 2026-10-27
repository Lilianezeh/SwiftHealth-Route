/** Forgot your password `/forgot-password`. Requirements: FR-54, FR-56. UI spec 3.1d. A server page that only holds the client
 * component. `/reset-password` redirects here (next.config.ts). Not for search engines (the dashboards layout says so). */
import type { Metadata } from "next";

import { ForgotPassword } from "@/components/account/ForgotPassword";

export const metadata: Metadata = { title: "Forgot your password?" };

export default function ForgotPasswordPage() {
  return <ForgotPassword />;
}
