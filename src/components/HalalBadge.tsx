import { BadgeCheck } from "lucide-react";
import { getRestaurantData } from "@/lib/data";

/**
 * "100% Halal" chip, reused wherever the site states the halal commitment.
 * The wording comes from restaurant.json (`halal.badge`), so every placement
 * says exactly the same thing.
 *
 * Green on purpose: it is the colour most people associate with halal, and it
 * stands apart from the maroon/gold brand palette, so the badge reads as a
 * distinct promise rather than one more decorative label.
 *
 * `tone` picks the surface it sits on: "light" for cream/white sections,
 * "dark" for the photo hero and the maroon sections.
 */
export default function HalalBadge({
  tone = "light",
  size = "sm",
  className = "",
}: {
  tone?: "light" | "dark";
  size?: "sm" | "md";
  className?: string;
}) {
  const { halal } = getRestaurantData();

  const toneClass =
    tone === "dark"
      ? "bg-emerald-500/15 border-emerald-300/40 text-white"
      : "bg-emerald-50 border-emerald-600/25 text-emerald-800";
  const iconClass = tone === "dark" ? "text-emerald-300" : "text-emerald-600";
  const sizeClass =
    size === "md" ? "px-4 py-1.5 text-sm gap-2" : "px-3 py-1 text-xs gap-1.5";

  return (
    <span
      className={`inline-flex items-center rounded-full border font-semibold tracking-wide ${toneClass} ${sizeClass} ${className}`}
    >
      <BadgeCheck className={`${size === "md" ? "w-4 h-4" : "w-3.5 h-3.5"} ${iconClass}`} />
      {halal.badge}
    </span>
  );
}
