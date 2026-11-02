/** The sign-up `/sign-up`. Requirements: FR-48, FR-49. UI spec 3.1c. A server page that only holds the form. It sits in the staff-area
 * layout, so search engines skip it. `?as=owner` (from For facilities) and `?as=staff` (from the Staff portal) open the form with
 * that kind already chosen; with no value, or any other, the page asks as before (the owner's request of 2026-11-02).
 * `searchParams` is a promise in Next.js 15, so the page is `async`. */
import type { Metadata } from "next";

import { SignUpForm } from "@/components/account/SignUpForm";
import { signUpKindFromAddress } from "@/lib/account/signupKind";

export const metadata: Metadata = { title: "Sign up" };

type Props = { searchParams?: Promise<{ as?: string | string[] }> };

export default async function SignUpPage({ searchParams }: Props) {
  const chosen = searchParams ? (await searchParams).as : undefined;
  return <SignUpForm initialKind={signUpKindFromAddress(chosen)} />;
}
