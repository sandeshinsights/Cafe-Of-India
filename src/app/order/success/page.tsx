"use client";

import Link from "next/link";
import { CheckCircle, Home } from "lucide-react";

export default function OrderSuccess() {
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4 pt-20">
      <div className="max-w-md w-full text-center bg-white rounded-2xl p-8 md:p-12 shadow-lg border border-gray-100">
        <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-6" />
        <h1 className="font-heading text-3xl font-bold text-primary mb-3">
          Order Confirmed!
        </h1>
        <p className="text-text-light mb-2">
          Thank you for your order. Your payment was successful.
        </p>
        <p className="text-text-light text-sm mb-8">
          We&apos;re preparing your food now. You&apos;ll receive a confirmation email shortly.
        </p>
        <div className="space-y-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 w-full px-6 py-3 bg-primary hover:bg-primary-light text-white font-semibold rounded-lg transition-colors"
          >
            <Home className="w-5 h-5" />
            Back to Home
          </Link>
          <a
            href="tel:978-897-9227"
            className="block text-sm text-text-light hover:text-primary transition-colors"
          >
            Questions? Call us at (978) 897-9227
          </a>
        </div>
      </div>
    </div>
  );
}