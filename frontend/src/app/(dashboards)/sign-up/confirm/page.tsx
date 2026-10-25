/** The codes of the sign-up `/sign-up/confirm`. Requirements: FR-48, FR-49. UI spec 3.1c. A server page that only holds the client
 * component. */
import type { Metadata } from "next";

import { SignUpConfirm } from "@/components/account/SignUpConfirm";

export const metadata: Metadata = { title: "Confirm your sign-up" };

export default function SignUpConfirmPage() {
  return <SignUpConfirm />;
}
