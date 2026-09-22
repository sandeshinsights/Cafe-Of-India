import { useId } from "react";
import { Amiri } from "next/font/google";
import { getRestaurantData } from "@/lib/data";

/**
 * Round "halal seal": the Arabic word حلال in the centre, with
 * "100% HALAL · EVERY DISH · ALWAYS ·" set around the rim.
 *
 * Why a seal rather than another text chip: a small "100% Halal" pill in the
 * hero's trust row read as one detail among four and was easy to miss. The
 * people this matters to recognise the Arabic mark at a glance — it is the
 * symbol they look for on a shop window or a package — and a stamp-like
 * emblem reads as a promise, not a label. Green for halal, the brand gold for
 * the rings, so it belongs to the site rather than looking pasted on.
 *
 * `spin` slowly turns the rim text (hero only). It is `motion-safe:`, so
 * prefers-reduced-motion leaves it still, and only the rim turns — the Arabic
 * in the centre never moves, so it is always readable.
 *
 * Amiri is loaded here rather than in layout.tsx: only this component uses
 * Arabic, and next/font preloads it only on routes that render it. The
 * `arabic` subset keeps the file small.
 */

const amiri = Amiri({
  subsets: ["arabic"],
  weight: "700",
  display: "swap",
});

const RIM_TEXT = "100% HALAL • EVERY DISH • ALWAYS • ";

export default function HalalSeal({
  className = "w-28 h-28",
  spin = false,
}: {
  /** Size (and any positioning) — the seal fills this box. */
  className?: string;
  spin?: boolean;
}) {
  const { halal } = getRestaurantData();
  // Unique per instance: the seal appears several times on one page, and the
  // rim path is referenced by id.
  const rimId = `halal-seal-rim-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  return (
    <div
      role="img"
      aria-label={`${halal.badge} — every dish, always`}
      className={`relative shrink-0 select-none [container-type:inline-size] ${className}`}
    >
      <svg
        viewBox="0 0 200 200"
        aria-hidden="true"
        className={`absolute inset-0 w-full h-full drop-shadow-lg ${
          spin ? "motion-safe:animate-[spin_40s_linear_infinite]" : ""
        }`}
      >
        <defs>
          {/* The rim text runs along this circle (r = 78), starting at the top. */}
          <path
            id={rimId}
            d="M 100,22 a 78,78 0 1,1 -0.01,0"
            fill="none"
          />
        </defs>

        {/* Body */}
        <circle cx="100" cy="100" r="97" fill="#065F46" />
        {/* Outer gold ring */}
        <circle cx="100" cy="100" r="93" fill="none" stroke="#C4973B" strokeWidth="2.5" />
        {/* Inner gold ring, framing the Arabic */}
        <circle cx="100" cy="100" r="62" fill="none" stroke="#C4973B" strokeOpacity="0.7" strokeWidth="1.5" />
        <circle cx="100" cy="100" r="58" fill="none" stroke="#C4973B" strokeOpacity="0.35" strokeWidth="1" />

        <text
          fill="#E9C77B"
          fontSize="14"
          fontWeight="700"
          letterSpacing="2"
          // CSS variables do not work in SVG presentation attributes, only in
          // style — so the brand font goes here.
          style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}
        >
          {/* textLength stretches the phrase to exactly one lap (2π·78 ≈ 490),
              so the rim closes without a gap or an overlap. */}
          <textPath href={`#${rimId}`} textLength="486" lengthAdjust="spacing">
            {RIM_TEXT}
          </textPath>
        </text>
      </svg>

      {/* Centre: never rotates. Font sizes are in cqw (percent of the seal's
          width, via container-type on the root), so it scales as one piece. */}
      <div className="absolute inset-[20%] flex flex-col items-center justify-center text-center">
        <span
          lang="ar"
          dir="rtl"
          className={`${amiri.className} text-white leading-none`}
          style={{ fontSize: "clamp(1rem, 30cqw, 3rem)" }}
        >
          حلال
        </span>
        <span
          className="mt-[6%] font-bold tracking-[0.15em] text-[#E9C77B] leading-none"
          style={{ fontSize: "clamp(0.45rem, 11cqw, 0.9rem)" }}
        >
          100%
        </span>
      </div>
    </div>
  );
}
