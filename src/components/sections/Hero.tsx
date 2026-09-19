import { Phone, UtensilsCrossed, Star, Bike } from "lucide-react";
import { getRestaurantData } from "@/lib/data";
import { mapsSearchUrl } from "@/lib/utils";
import HeroBackdrop, { type HeroImage } from "@/components/HeroBackdrop";
import OpenStatus from "@/components/OpenStatus";

/**
 * Hero Section
 *
 * WHAT IT DOES:
 * - Full-width banner at the top of the homepage
 * - Large headline + subheadline from restaurant.json
 * - Two CTA buttons: "Order Online" (scrolls to the menu) and "Call to Order"
 * - A trust row under them: Google rating, live open/closed status, and
 *   pickup & delivery — the three things a hungry visitor checks first
 * - Slowly crossfading, gently zooming background behind a dark scrim
 */

/**
 * Backdrop frames — real photographs only: our own dining room, then two of
 * our dishes. The previous frames were AI-generated food shots, which read as
 * stock the moment anyone looks closely. These three are also the highest-
 * resolution real photos we have, which matters at full-screen width; the
 * dish frames are reused elsewhere on the page, so they add no extra weight.
 */
const backdrop: HeroImage[] = [
  { src: "/images/about/restaurant-interior.jpg", alt: "Cafe of India dining room" },
  { src: "/images/dishes/menu-115-butter-chicken.jpg", alt: "" },
  { src: "/images/dishes/momo-steamed.jpg", alt: "" },
];

export default function Hero() {
  const { hero, phone, rating, name, address } = getRestaurantData();

  return (
    // pb is larger than pt so the centred content sits slightly high, leaving
    // the scroll cue its own clear band at the bottom. With symmetric padding
    // the cue collided with the CTA buttons on laptop-height screens.
    <section
      id="hero"
      className="relative min-h-screen flex items-center justify-center pt-24 pb-32 overflow-hidden"
    >
      <HeroBackdrop images={backdrop} />

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 text-center text-white">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-5 py-2 mb-8 motion-safe:animate-rise [animation-delay:100ms]">
          <UtensilsCrossed className="w-4 h-4 text-secondary" />
          <span className="text-sm font-medium tracking-wide uppercase">
            Authentic Indian &amp; Nepali Cuisine
          </span>
        </div>

        {/* Headline */}
        <h1 className="font-heading text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6 text-white motion-safe:animate-rise [animation-delay:200ms]">
          {hero.headline}
        </h1>

        {/* Gold rule, echoing the divider used on the section headings below */}
        <div className="w-20 h-px bg-secondary/70 mx-auto mb-6 motion-safe:animate-rise [animation-delay:300ms]" />

        {/* Subheadline */}
        <p className="text-lg sm:text-xl md:text-2xl text-white/90 max-w-2xl mx-auto mb-10 leading-relaxed motion-safe:animate-rise [animation-delay:400ms]">
          {hero.subheadline}
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 motion-safe:animate-rise [animation-delay:500ms]">
          <a
            href="#menu"
            className="inline-flex items-center gap-2 bg-secondary hover:bg-secondary-light text-white px-8 py-4 rounded-full text-lg font-semibold transition-all duration-200 hover:scale-105 shadow-lg"
          >
            <UtensilsCrossed className="w-5 h-5" />
            {hero.ctaPrimary}
          </a>
          <a
            href={`tel:${phone}`}
            className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/30 text-white px-8 py-4 rounded-full text-lg font-semibold transition-all duration-200"
          >
            <Phone className="w-5 h-5" />
            {hero.ctaSecondary}
          </a>
        </div>

        {/* Trust row */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-white/85 motion-safe:animate-rise [animation-delay:600ms]">
          <a
            href={mapsSearchUrl(`${name}, ${address.full}`)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-white transition-colors"
          >
            <Star className="w-4 h-4 fill-secondary text-secondary" />
            <span className="font-semibold text-white">{rating.value}</span>
            <span>· {rating.count} {rating.source} reviews</span>
          </a>
          <span className="hidden sm:inline text-white/30" aria-hidden="true">|</span>
          <OpenStatus />
          <span className="hidden sm:inline text-white/30" aria-hidden="true">|</span>
          <span className="inline-flex items-center gap-1.5">
            <Bike className="w-4 h-4 text-secondary" />
            Pickup &amp; Delivery
          </span>
        </div>
      </div>

      {/* Scroll indicator. Anchored to the SECTION, not the content box — inside
          the centred content it sat just under the buttons instead of at the
          bottom of the screen. */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 motion-safe:animate-bounce">
        <div className="w-6 h-10 border-2 border-white/40 rounded-full flex justify-center pt-2">
          <div className="w-1.5 h-3 bg-white/60 rounded-full" />
        </div>
      </div>
    </section>
  );
}
