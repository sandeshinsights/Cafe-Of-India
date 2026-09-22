import { Phone, UtensilsCrossed, Star, Bike, BadgeCheck } from "lucide-react";
import { getRestaurantData } from "@/lib/data";
import { mapsSearchUrl } from "@/lib/utils";
import HeroBackdrop, { type HeroImage } from "@/components/HeroBackdrop";
import OpenStatus from "@/components/OpenStatus";
import HalalSeal from "@/components/HalalSeal";

/**
 * Hero Section
 *
 * WHAT IT DOES:
 * - Full-width banner at the top of the homepage
 * - Large headline + subheadline from restaurant.json
 * - Two CTA buttons: "Order Online" (scrolls to the menu) and "Call to Order"
 * - A trust row under them: Google rating, live open/closed status, and
 *   pickup & delivery
 * - 100% halal, said twice and loudly, because for the guests who need it, it
 *   decides whether they order at all: in the top badge (the first line anyone
 *   reads) and as a turning seal with the Arabic حلال (beside the headline on
 *   wide screens, in the bottom-right corner otherwise). A small
 *   chip in the trust row was tried first and read as fine print.
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
  const { hero, phone, rating, name, address, halal } = getRestaurantData();

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
        {/* Badge — two halves, so "100% Halal" sits in the very first line
            anyone reads, in its own green, instead of down in the small print. */}
        <div className="inline-flex items-stretch rounded-full border border-white/25 overflow-hidden backdrop-blur-sm mb-8 text-xs sm:text-sm font-semibold tracking-wide uppercase motion-safe:animate-rise [animation-delay:100ms]">
          <span className="flex items-center gap-2 bg-white/10 pl-4 pr-3 sm:pl-5 py-2">
            <UtensilsCrossed className="hidden sm:block w-4 h-4 text-secondary" />
            Authentic Indian &amp; Nepali
          </span>
          <span className="flex items-center gap-1.5 bg-emerald-600 text-white pl-3 pr-4 sm:pr-5 py-2">
            <BadgeCheck className="w-4 h-4" />
            {halal.badge}
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

      {/* Halal seal. Positioned by this wrapper, animated inside it — the
          rise animation sets `transform`, which would wipe out a translate
          on the same element.
          - 1440px and up: beside the headline, mid-right, where it is seen
            with the headline itself. From 1440 the centred content (max-w-4xl)
            leaves enough room at the side for a 160px seal.
          - Narrower: the bottom-right corner, which no content uses at any
            width (text is centred; the pb-32 band keeps the bottom clear).
          The slowly turning rim is what pulls the eye to it. */}
      <div className="absolute z-10 bottom-4 right-4 w-24 h-24 sm:bottom-6 sm:right-6 sm:w-32 sm:h-32 wide:bottom-auto wide:top-1/2 wide:-translate-y-1/2 wide:right-[4%] wide:w-40 wide:h-40">
        <HalalSeal
          spin
          className="w-full h-full motion-safe:animate-rise [animation-delay:700ms]"
        />
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
