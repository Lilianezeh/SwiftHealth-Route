"use client";

/** Share via WhatsApp and Copy link. Requirements: FR-12, NFR-07, NFR-10. Spec: specs/2026-10-13-listing-page/requirements.md D4.
 * The shared link is only `<site address>/listing/<slug>` (lib/formatters/whatsapp.ts: the origin and the slug, never a query, a hash or a
 * position), even when the page was opened with one. "Share via WhatsApp" opens WhatsApp with no number, so WhatsApp asks who to send it to;
 * its text is plain, without WhatsApp's glyph (the glyph is on the contact button only). "Copy link" copies the same link; when the browser
 * has no clipboard or refuses, the link is shown in a read-only field to copy by hand. The line "Link copied" is in a live region.
 * It is rendered only after the listing has loaded in the browser, so `window` is always there.
 */
import { Link as LinkIcon, Share2 } from "lucide-react";
import { useId, useState } from "react";

import { buttonClasses } from "@/components/ui/buttonStyles";
import { DecorativeIcon } from "@/components/ui/DecorativeIcon";
import { shareLink, whatsAppShareUrl } from "@/lib/formatters/whatsapp";

type ShareButtonsProps = { slug: string; facilityName: string };

export function ShareButtons({ slug, facilityName }: ShareButtonsProps) {
  const [message, setMessage] = useState("");
  const [showField, setShowField] = useState(false);
  const fieldId = useId();
  const link = shareLink(slug, window.location.origin);

  async function copyLink() {
    try {
      if (!navigator.clipboard) throw new Error("There is no clipboard.");
      await navigator.clipboard.writeText(link);
      setShowField(false);
      setMessage("Link copied");
    } catch {
      setMessage("");
      setShowField(true);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <div className="min-w-[8.5rem] flex-1">
          <a
            href={whatsAppShareUrl(facilityName, link)}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClasses("secondary")}
          >
            <DecorativeIcon icon={Share2} />
            Share via WhatsApp{" "}
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </div>
        <div className="min-w-[8.5rem] flex-1">
          <button type="button" onClick={copyLink} className={buttonClasses("secondary")}>
            <DecorativeIcon icon={LinkIcon} />
            Copy link
          </button>
        </div>
      </div>
      {/* The live region is always there, so a screen reader announces the sentence when it is filled in. */}
      <p role="status" aria-live="polite" className="text-base text-ink">
        {message}
      </p>
      {showField && (
        <div>
          <label htmlFor={fieldId} className="sr-only">
            Link to copy
          </label>
          <input
            id={fieldId}
            readOnly
            value={link}
            onFocus={(event) => event.currentTarget.select()}
            className="min-h-12 w-full rounded-xl border border-line bg-surface px-3 text-base text-ink"
          />
        </div>
      )}
    </div>
  );
}
