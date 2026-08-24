"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { META_PIXEL_ID, trackMeta, captureFbclid } from "@/lib/meta-pixel";

/**
 * Loads the Meta Pixel and fires PageView.
 *
 * Deliberately NOT gated on the cookie banner: the banner governs GA4 only, and
 * the Pixel is configured to run for all visitors (see the Meta section of the
 * privacy policy). If that decision is ever revisited, gate the <Script/> below
 * the same way CookieConsent gates gtag.
 *
 * PageView is fired from the effect rather than from the init snippet so client
 * navigations (/privacy, /terms, /order/success) are counted too. The snippet
 * must therefore NOT call fbq('track','PageView') itself — that would double
 * every landing page.
 */
export default function MetaPixel() {
  const pathname = usePathname();

  // Runs before the first PageView so an ad click's fbclid is banked even if the
  // pixel script itself is slow or blocked.
  useEffect(() => {
    captureFbclid();
  }, []);

  useEffect(() => {
    if (!META_PIXEL_ID) return;
    trackMeta("PageView");
  }, [pathname]);

  if (!META_PIXEL_ID) return null;

  return (
    <>
      <Script
        id="meta-pixel-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${META_PIXEL_ID}');
          `.trim(),
        }}
      />
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          alt=""
          src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  );
}
