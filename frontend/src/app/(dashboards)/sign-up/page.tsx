/** The sign-up `/sign-up`. Requirements: FR-48, FR-49. UI spec 3.1c. A server page that only holds the form. It sits in the staff-area
 * layout, so search engines skip it. */
import type { Metadata } from "next";

import { SignUpForm } from "@/components/account/SignUpForm";

export const metadata: Metadata = { title: "Sign up" };

export default function SignUpPage() {
  return <SignUpForm />;
}
