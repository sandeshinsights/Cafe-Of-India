"use client";

import { useState, useEffect } from "react";
import { Cookie, X } from "lucide-react";

/**
 * Cookie Consent Banner
 * 
 * WHAT IT DOES:
 * - Shows a banner at the bottom of the page on first visit
 * - Asks the user to accept cookies (required for GA4 compliance)
 * - If accepted: stores preference in localStorage and loads GA4
 * - If declined: stores preference and does NOT load GA4
 * - Remembers the choice — never shows again after selection
 * 
 * WHY "use client":
 * - Uses useState and useEffect for browser-side logic
 * - Reads/writes localStorage
 * - Manages GA4 script loading dynamically
 */

export default function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Only show banner if user hasn't already made a choice
    const consent = localStorage.getItem("cookie-consent");
    if (consent === null) {
      setShow(true);
    } else if (consent === "accepted") {
      loadGA4();
    }
  }, []);

  const loadGA4 = () => {
    // Load Google Analytics 4 dynamically
    // Replace G-XXXXXXXXXX with your real GA4 ID in Phase 1 Step 6
    const gaId = process.env.NEXT_PUBLIC_GA_ID;
    if (!gaId || gaId === "G-XXXXXXXXXX") return;

    // Load gtag.js script
    const script = document.createElement("script");
    script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
    script.async = true;
    document.head.appendChild(script);

    // Initialize gtag
    const inlineScript = document.createElement("script");
    inlineScript.innerHTML = `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${gaId}', { anonymize_ip: true });
    `;
    document.head.appendChild(inlineScript);
  };

  const handleAccept = () => {
    localStorage.setItem("cookie-consent", "accepted");
    setShow(false);
    loadGA4();
  };

  const handleDecline = () => {
    localStorage.setItem("cookie-consent", "declined");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-0">
      <div className="max-w-4xl mx-auto bg-white rounded-t-2xl md:rounded-2xl shadow-2xl border border-gray-200 p-6 md:mb-4">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
          {/* Icon */}
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center">
            <Cookie className="w-6 h-6 text-secondary" />
          </div>

          {/* Text */}
          <div className="flex-1">
            <h3 className="font-heading text-lg font-bold text-primary mb-1">
              We Use Cookies
            </h3>
            <p className="text-text-light text-sm leading-relaxed">
              We use cookies to improve your experience and understand how our website is used. 
              By clicking &ldquo;Accept,&rdquo; you consent to our use of cookies.{" "}
              <a href="/privacy" className="text-secondary underline hover:text-primary transition-colors">
                Privacy Policy
              </a>
            </p>
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-3 flex-shrink-0 w-full md:w-auto">
            <button
              onClick={handleAccept}
              className="flex-1 md:flex-none bg-primary hover:bg-primary-light text-white px-6 py-2.5 rounded-full text-sm font-semibold transition-colors"
            >
              Accept
            </button>
            <button
              onClick={handleDecline}
              className="flex-1 md:flex-none border border-gray-300 text-text-light hover:border-primary hover:text-primary px-6 py-2.5 rounded-full text-sm font-semibold transition-colors"
            >
              Decline
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}