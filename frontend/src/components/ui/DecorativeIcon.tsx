/** An icon that is only decoration. Owner's decision, 2026-10-09 (UI spec): lucide-react, one icon per import.
 *
 * It is hidden from screen readers and from the tab order, and it always sits next to a text label that carries the
 * meaning. Use it like this: `import { Phone } from "lucide-react"` and `<DecorativeIcon icon={Phone} />`.
 */
import type { LucideIcon } from "lucide-react";

type DecorativeIconProps = { icon: LucideIcon; className?: string };

export function DecorativeIcon({ icon: Icon, className = "h-5 w-5" }: DecorativeIconProps) {
  return <Icon aria-hidden="true" focusable="false" className={`shrink-0 ${className}`} />;
}
