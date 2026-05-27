"use client";
import Link from "next/link";
import { Home, ArrowLeft } from "lucide-react";

/**
 * Custom 404 Page
 * 
 * WHAT IT DOES:
 * - Shows a friendly error page when someone visits a non-existent URL
 * - Provides links back to the homepage
 * - Matches the restaurant's theme/design
 */

export default function NotFound() {
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="font-heading text-8xl md:text-9xl font-bold text-primary mb-4">
          404
        </h1>
        <h2 className="font-heading text-2xl md:text-3xl font-bold text-text-main mb-4">
          Page Not Found
        </h2>
        <p className="text-text-light text-lg max-w-md mx-auto mb-8">
          Sorry, the page you&apos;re looking for doesn&apos;t exist. It might have been moved or deleted.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary-light text-white px-6 py-3 rounded-full font-semibold transition-colors"
          >
            <Home className="w-5 h-5" />
            Go Home
          </Link>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-2 border-2 border-primary text-primary hover:bg-primary hover:text-white px-6 py-3 rounded-full font-semibold transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}