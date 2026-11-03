"use client";

/** The red emergency button of the header. Requirements: FR-02 (on every page), NFR-10. UI spec, "Layout" and 2.5 (owner, 2026-11-03).
 * On every page it is a link to the emergency page. ON that page it is the current page: the same red button, but a plain element with
 * aria-current="page" and no link, so a visitor is not offered a link to the page they are on, and a screen reader says "current page".
 * It is the one part of the header that reads the address (usePathname), so it is a small client part; during the server render
 * `usePathname` already knows the address, so the right version is drawn at once and nothing changes after the page has loaded. It calls
 * nothing and keeps nothing. The look is one string for both versions, so they cannot drift apart. The name comes from config/site.ts.
 */
import { Siren } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { DecorativeIcon } from "@/components/ui/DecorativeIcon";
import { siteConfig } from "@/config/site";

const LOOK =
  "inline-flex min-h-12 items-center gap-1.5 rounded-md border-2 border-white bg-emergency px-2 text-base font-semibold text-white sm:px-3.5";

type EmergencyButtonProps = { prefetch: false | undefined };

export function EmergencyButton({ prefetch }: EmergencyButtonProps) {
  const pathname = usePathname();
  const { href, label } = siteConfig.emergencyLink;
  // A small siren, white like the text (currentColor), hidden from screen readers; never a cross (R36).
  const content = (
    <>
      <DecorativeIcon icon={Siren} className="h-4 w-4" />
      {label}
    </>
  );

  if (pathname === href) {
    return (
      <span aria-current="page" className={LOOK}>
        {content}
      </span>
    );
  }
  return (
    <Link href={href} prefetch={prefetch} className={LOOK}>
      {content}
    </Link>
  );
}
