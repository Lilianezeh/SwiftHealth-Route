"use client";

/** Share my location: the phone's exact position, sent by WhatsApp or SMS. Requirements: US-14, FR-24, NFR-07, NFR-10.
 * UI spec 2.5, point 3; decision A7 (specs/2026-10-17-swiftrescue/requirements.md).
 *
 * The position is asked for only after a tap, is exact and fresh (a rescuer needs the real place), and lives in this
 * component's memory only: not in any storage, not in an address, not sent to our API, not logged. It goes only into the link the
 * visitor chooses to follow. It is forgotten when they tap Done or leave the page.
 */
import { MapPin, MessageCircle, MessageSquareText } from "lucide-react";
import { useState } from "react";

import { buttonClasses } from "@/components/ui/buttonStyles";
import { DecorativeIcon } from "@/components/ui/DecorativeIcon";
import { buildLocationMessage, smsShareLink, whatsappShareLink } from "@/lib/emergency/shareText";

type Position = { latitude: number; longitude: number };
type Step = { name: "idle" } | { name: "asking" } | { name: "failed" } | { name: "ready"; position: Position };

const EXACT_AND_FRESH: PositionOptions = { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 };

export function ShareMyLocation() {
  const [step, setStep] = useState<Step>({ name: "idle" });

  function findMe() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStep({ name: "failed" });
      return;
    }
    setStep({ name: "asking" });
    navigator.geolocation.getCurrentPosition(
      (result) =>
        setStep({ name: "ready", position: { latitude: result.coords.latitude, longitude: result.coords.longitude } }),
      () => setStep({ name: "failed" }),
      EXACT_AND_FRESH,
    );
  }

  const message = step.name === "ready" ? buildLocationMessage(step.position) : "";

  return (
    <section aria-labelledby="share-location-heading" className="flex flex-col gap-3">
      <h2 id="share-location-heading" className="text-xl font-bold text-forest">
        Share my location
      </h2>
      {step.name !== "ready" && (
        <button type="button" onClick={findMe} disabled={step.name === "asking"} className={buttonClasses("secondary")}>
          <DecorativeIcon icon={MapPin} />
          Share my location
        </button>
      )}
      {step.name === "asking" && (
        <p role="status" className="text-base text-ink">
          Finding your location…
        </p>
      )}
      {step.name === "failed" && (
        <p role="status" className="text-base text-ink">
          We could not get your location. Call 112 and say where you are.
        </p>
      )}
      {step.name === "ready" && (
        <div className="flex flex-col gap-3">
          <p role="status" className="text-base text-ink">
            Your location is ready to send. We do not keep it.
          </p>
          <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
            <a
              href={whatsappShareLink(message)}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClasses("primary")}
            >
              <DecorativeIcon icon={MessageCircle} />
              Send on WhatsApp
            </a>
            <a href={smsShareLink(message)} className={buttonClasses("primary")}>
              <DecorativeIcon icon={MessageSquareText} />
              Send by SMS
            </a>
          </div>
          <button type="button" onClick={() => setStep({ name: "idle" })} className={buttonClasses("secondary")}>
            Done
          </button>
        </div>
      )}
    </section>
  );
}
