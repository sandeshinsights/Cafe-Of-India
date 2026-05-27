import { Phone, UtensilsCrossed } from "lucide-react";
import { getRestaurantData } from "@/lib/data";

/**
 * Hero Section
 * 
 * WHAT IT DOES:
 * - Full-width banner at the top of the homepage
 * - Large headline + subheadline from restaurant.json
 * - Two CTA buttons: "View Menu" (scrolls down) and "Call to Order" (calls phone)
 * - Dark gradient overlay on a placeholder background
 */

export default function Hero() {
  const { hero, phone } = getRestaurantData();

  return (
    <section
      id="hero"
      className="relative min-h-screen flex items-center justify-center"
    >
      {/* Background with gradient overlay */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/images/hero/hero-bg.jpg')",
          backgroundColor: "#2D2D2D",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/70" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 text-center text-white">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-5 py-2 mb-8">
          <UtensilsCrossed className="w-4 h-4 text-secondary" />
          <span className="text-sm font-medium tracking-wide uppercase">
            Authentic Indian Cuisine
          </span>
        </div>

        {/* Headline */}
        <h1 className="font-heading text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6">
          {hero.headline}
        </h1>

        {/* Subheadline */}
        <p className="text-lg sm:text-xl md:text-2xl text-white/90 max-w-2xl mx-auto mb-10 leading-relaxed">
          {hero.subheadline}
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
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

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-white/40 rounded-full flex justify-center pt-2">
            <div className="w-1.5 h-3 bg-white/60 rounded-full" />
          </div>
        </div>
      </div>
    </section>
  );
}