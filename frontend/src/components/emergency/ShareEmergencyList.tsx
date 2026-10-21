"use client";

/** Share emergency list: a plain-text list of numbers sent by WhatsApp or SMS. Requirements: US-09, FR-18, NFR-10.
 * UI spec 2.5, point 4; decision A8 (specs/2026-10-17-swiftrescue/requirements.md). Two links, no script needed to follow them.
 * The text holds names and numbers only, never a position. Before the list has loaded it shares 112 only.
 */
import { MessageCircle, MessageSquareText } from "lucide-react";
import { useEffect, useState } from "react";

import { buttonClasses } from "@/components/ui/buttonStyles";
import { DecorativeIcon } from "@/components/ui/DecorativeIcon";
import { buildEmergencyListText, smsShareLink, whatsappShareLink } from "@/lib/emergency/shareText";
import type { EmergencyResponse } from "@/types/api";

type ShareEmergencyListProps = { response: EmergencyResponse | null };

export function ShareEmergencyList({ response }: ShareEmergencyListProps) {
  // The page address is read after the first render, so the server and the browser draw the same page.
  const [pageAddress, setPageAddress] = useState("");
  useEffect(() => setPageAddress(`${window.location.origin}/emergency`), []);
  const text = buildEmergencyListText(response, pageAddress);

  return (
    <section aria-labelledby="share-list-heading" className="flex flex-col gap-3">
      <h2 id="share-list-heading" className="text-xl font-bold text-forest">
        Share emergency list
      </h2>
      <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
        <a
          href={whatsappShareLink(text)}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClasses("secondary")}
        >
          <DecorativeIcon icon={MessageCircle} />
          Share on WhatsApp
        </a>
        <a href={smsShareLink(text)} className={buttonClasses("secondary")}>
          <DecorativeIcon icon={MessageSquareText} />
          Share by SMS
        </a>
      </div>
    </section>
  );
}
