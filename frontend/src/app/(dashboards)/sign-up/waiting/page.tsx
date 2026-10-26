/** Where a staff sign-up waits `/sign-up/waiting`. Requirements: FR-49. UI spec 3.1c. Static text: an admin looks at the request, and
 * may phone the number given (decision D20: without Termii the phone is confirmed by that call). No medical text. */
import type { Metadata } from "next";
import Link from "next/link";

import { buttonClasses } from "@/components/ui/buttonStyles";

export const metadata: Metadata = { title: "Waiting for approval" };

export default function SignUpWaitingPage() {
  return (
    <section className="mx-auto flex max-w-md flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-bold text-forest">Thank you. Your request is with an admin.</h1>
      <p className="text-base text-ink">
        You cannot use the staff area until an admin approves you. We may phone you at the number you gave, to check it.
      </p>
      <p className="text-base text-ink">You will be able to log in once you are approved.</p>
      <Link href="/" className={buttonClasses("primary")}>
        Back to the home page
      </Link>
    </section>
  );
}
