"use client";

/** Wraps a photo of the home page so that it fades and slides into place once, when it scrolls into view. Requirements: US-13, NFR-01, NFR-10.
 * Spec: specs/2026-10-22-home-photos/requirements.md part 3; tested by tests/unit/Reveal.test.tsx. It is the only client code of the sections.
 *
 * The server's HTML has no mark, so without JavaScript (or in a browser with no IntersectionObserver) the photo is simply shown. After the
 * script runs the wrapper is marked data-reveal="hidden" and, when 15% of it is in view, data-reveal="revealed" (once, then the observer stops).
 * The look is in globals.css (.photo-reveal): only opacity and transform change, so the layout never shifts, and all of it is inside the
 * "no-preference" guard. With "reduce motion" on, this script does not even start: no observer, no mark, no movement.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";

type RevealProps = { children: ReactNode; className?: string };

export function Reveal({ children, className = "" }: RevealProps) {
  const wrapper = useRef<HTMLDivElement>(null);
  const [mark, setMark] = useState<"hidden" | "revealed" | undefined>(undefined);

  useEffect(() => {
    const element = wrapper.current;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (!element || reducedMotion || typeof IntersectionObserver === "undefined") return;

    setMark("hidden");
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setMark("revealed");
        observer.disconnect();
      },
      { threshold: 0.15 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={wrapper} data-reveal={mark} className={`photo-reveal ${className}`.trim()}>
      {children}
    </div>
  );
}
