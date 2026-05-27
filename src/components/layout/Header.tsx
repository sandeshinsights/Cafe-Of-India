"use client";

import { useState } from "react";
import Link from "next/link";
import { Phone, Menu, X } from "lucide-react";
import { getSiteConfig, getRestaurantData } from "@/lib/data";
import { cn } from "@/lib/utils";

/**
 * Header Component
 * 
 * WHAT IT DOES:
 * - Sticky navigation bar at the top of every page
 * - Shows restaurant name/logo on the left
 * - Shows navigation links in the center
 * - Shows "Order Now" CTA button on the right
 * - On mobile: hamburger icon opens slide-out menu
 * - Background becomes opaque when user scrolls down
 * 
 * WHY "use client":
 * - Uses useState for scroll detection and mobile menu toggle
 * - Client components can respond to browser events (scroll, click)
 */

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Detect scroll to add background blur
  if (typeof window !== "undefined") {
    window.addEventListener("scroll", () => {
      setScrolled(window.scrollY > 20);
    });
  }

  const { navigation, ctaButton } = getSiteConfig();
  const { name } = getRestaurantData();

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-white/95 backdrop-blur-md shadow-md"
          : "bg-transparent"
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo / Restaurant Name */}
          <Link href="/" className="flex-shrink-0">
            <h1 className="font-heading text-2xl md:text-3xl font-bold text-primary">
              {name}
            </h1>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            {navigation.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-text-main hover:text-primary font-medium transition-colors duration-200"
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* CTA Button + Mobile Toggle */}
          <div className="flex items-center space-x-4">
            {/* Order Now Button (Desktop) */}
            <a
              href={ctaButton.href}
              className="hidden md:inline-flex items-center gap-2 bg-primary hover:bg-primary-light text-white px-6 py-2.5 rounded-full font-semibold transition-colors duration-200"
            >
              <Phone className="w-4 h-4" />
              {ctaButton.label}
            </a>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 text-primary"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Dropdown */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-cream-dark shadow-lg">
          <nav className="px-4 py-4 space-y-3">
            {navigation.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="block text-text-main hover:text-primary font-medium py-2 transition-colors"
              >
                {item.label}
              </a>
            ))}
            <a
              href={ctaButton.href}
              className="flex items-center justify-center gap-2 bg-primary text-white px-6 py-3 rounded-full font-semibold mt-4 transition-colors"
            >
              <Phone className="w-4 h-4" />
              {ctaButton.label}
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}