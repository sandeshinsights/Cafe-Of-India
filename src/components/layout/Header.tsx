"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Phone, Menu, X, ShoppingBag, UtensilsCrossed } from "lucide-react";
import {
  getSiteConfig,
  getRestaurantData,
  getNavigation,
  toHomeAnchor,
} from "@/lib/data";
import { cn } from "@/lib/utils";
import { useCart } from "@/context/CartContext";

/**
 * Site header.
 *
 * The primary button is "Order Online" (→ the menu), not a phone call: this is
 * an online-ordering site, and the phone number used to be the only CTA in the
 * header. The number is still one tap away — a secondary link on desktop and a
 * second button in the mobile menu.
 *
 * Nav links come from getNavigation() as "/#menu"-style hrefs, so they work
 * from every page the header renders on, not just the homepage.
 */

// Static JSON, so computed once.
const navItems = getNavigation();
const { ctaButton } = getSiteConfig();

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeHref, setActiveHref] = useState<string | null>(null);
  const { itemCount, openCart } = useCart();

  const { name, phone, phoneDisplay } = getRestaurantData();

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 20);
    }
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Scroll-spy: underline the nav link for the section in the middle of the
  // screen. A thin band at mid-viewport means exactly one section is "current"
  // at a time, however tall the sections are. EVERY homepage section is
  // observed, not just the linked ones: sections with no nav link (hero,
  // gallery, reviews, FAQ) then clear the underline instead of leaving the
  // previous section's link lit while the customer reads something else.
  useEffect(() => {
    const sections = Array.from(
      document.querySelectorAll<HTMLElement>("main section[id]")
    );
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveHref(`/#${entry.target.id}`);
        }
      },
      { rootMargin: "-50% 0px -50% 0px" }
    );
    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-30 transition-all duration-300",
        scrolled
          ? "bg-white/95 backdrop-blur-md shadow-md"
          : "bg-white/90 backdrop-blur-sm"
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo. A <span>, not an <h1>: the hero headline is the page's h1,
              and two h1s on every page muddies both SEO and screen readers. */}
          <Link href="/" className="flex-shrink-0">
            <span className="font-heading text-2xl md:text-3xl font-bold text-primary">
              {name}
            </span>
          </Link>

          {/* Desktop Nav — from lg (1024px). Logo + five links + cart + the
              Order Online button do not fit narrower: at 768-1023px labels like
              "Visit Us" wrapped onto two lines, so those widths use the
              compact header and the menu button instead. The phone number
              joins only from xl, where there is room for it too. */}
          <nav className="hidden lg:flex items-center space-x-5 xl:space-x-8">
            {navItems.map((item) => {
              const active = activeHref === item.href;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "location" : undefined}
                  className={cn(
                    "relative whitespace-nowrap font-medium transition-colors duration-200 py-1",
                    "after:absolute after:left-0 after:right-0 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-secondary after:transition-transform after:duration-300 after:origin-left",
                    active
                      ? "text-primary after:scale-x-100"
                      : "text-text-main hover:text-primary after:scale-x-0"
                  )}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>

          {/* Cart + CTA + Mobile Toggle */}
          <div className="flex items-center space-x-3">
            <a
              href={`tel:${phone}`}
              className="hidden xl:inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium text-text-main hover:text-primary transition-colors"
            >
              <Phone className="w-4 h-4" />
              {phoneDisplay}
            </a>

            <button
              onClick={openCart}
              className="relative p-2 text-primary hover:bg-primary/10 rounded-full transition-colors"
              aria-label="Open cart"
            >
              <ShoppingBag className="w-6 h-6" />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-secondary text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {itemCount > 99 ? "99+" : itemCount}
                </span>
              )}
            </button>

            <a
              href={toHomeAnchor(ctaButton.href)}
              className="hidden lg:inline-flex items-center gap-2 whitespace-nowrap bg-primary hover:bg-primary-light text-white px-5 xl:px-6 py-2.5 rounded-full font-semibold transition-colors duration-200"
            >
              <UtensilsCrossed className="w-4 h-4" />
              {ctaButton.label}
            </a>

            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 text-primary"
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <div className="lg:hidden bg-white border-t border-cream-dark shadow-lg">
          <nav className="px-4 py-4 space-y-3">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "block font-medium py-2 transition-colors",
                  activeHref === item.href
                    ? "text-primary"
                    : "text-text-main hover:text-primary"
                )}
              >
                {item.label}
              </a>
            ))}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <a
                href={toHomeAnchor(ctaButton.href)}
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-center gap-2 bg-primary text-white px-4 py-3 rounded-full font-semibold transition-colors"
              >
                <UtensilsCrossed className="w-4 h-4" />
                {ctaButton.label}
              </a>
              <a
                href={`tel:${phone}`}
                className="flex items-center justify-center gap-2 border border-primary/30 text-primary px-4 py-3 rounded-full font-semibold transition-colors"
              >
                <Phone className="w-4 h-4" />
                Call Us
              </a>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
