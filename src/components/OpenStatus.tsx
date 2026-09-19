"use client";

import { useSyncExternalStore } from "react";
import { ORDERING_CONFIG, formatMinutesTo12h } from "@/lib/ordering-hours";

/**
 * "Open now · until 9:00 PM" / "Opens today at 11:30 AM" / "Closed · opens
 * tomorrow at 11:30 AM".
 *
 * Display only — it gates nothing. Checkout enforces the real ordering window
 * through ordering-hours.ts, and this reads the same ORDERING_CONFIG so the two
 * cannot disagree about the hours.
 *
 * Computed in the browser, never on the server: the homepage is statically
 * rendered, so a server-computed status would be frozen at build time. The
 * server snapshot is null, which renders nothing, and the chip appears once
 * hydrated. Re-checked every 30s so a tab left open rolls over at opening and
 * closing time.
 */

const TZ = "America/New_York";

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Current minute-of-day in the restaurant's timezone. */
function nowMinutesET(): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return get("hour") * 60 + get("minute");
}

function subscribe(onChange: () => void) {
  const timer = window.setInterval(onChange, 30_000);
  return () => window.clearInterval(timer);
}

export default function OpenStatus({ className = "" }: { className?: string }) {
  const minutes = useSyncExternalStore(subscribe, nowMinutesET, () => null);
  if (minutes === null) return null;

  const open = toMinutes(ORDERING_CONFIG.openTime);
  const close = toMinutes(ORDERING_CONFIG.closeTime);
  const isOpen = minutes >= open && minutes < close;

  const label = isOpen
    ? `Open now · until ${formatMinutesTo12h(close)}`
    : minutes < open
      ? `Opens today at ${formatMinutesTo12h(open)}`
      : `Closed · opens tomorrow at ${formatMinutesTo12h(open)}`;

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className={`w-2 h-2 rounded-full ${isOpen ? "bg-emerald-400" : "bg-white/50"}`}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
