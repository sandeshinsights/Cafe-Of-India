"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle, Home, Loader2, Truck, Clock, ExternalLink, Info } from "lucide-react";

interface VerifyResult {
  success: boolean;
  orderId?: string;
  isDelivery?: boolean;
  deliveryType?: "asap" | "scheduled" | "manual_fallback";
  scheduledFor?: string;
  uberDeliveryId?: string;
  uberDeliveryStatus?: string;
  trackingUrl?: string;
  dropoffEta?: string;
  message?: string;
  /** Courier dispatch has not concluded yet — poll, don't conclude. */
  dispatchPending?: boolean;
}

/**
 * When the Stripe webhook wins the fulfillment claim, this page can load while
 * the webhook is still working — emails are spaced out and the Uber call takes a
 * moment. During that gap the order genuinely has no courier yet, and the page
 * used to read that as "manual delivery" and tell the customer so, permanently,
 * because it only ever fetched once. So: poll while dispatch is unresolved.
 */
const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 8; // ~16s, comfortably longer than a normal fulfillment pass

export default function OrderSuccess() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [orderInfo, setOrderInfo] = useState<VerifyResult | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");

    if (!sessionId) {
      setStatus("error");
      setMessage("No order session found. If you already paid, please contact us.");
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const verify = async (attempt: number) => {
      try {
        const res = await fetch("/api/verify-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const data: VerifyResult = await res.json();
        if (cancelled) return;

        if (!data.success) {
          // Only the first call decides what the customer sees. A later poll
          // failing must never replace a confirmed order with an error screen —
          // the payment is already confirmed at that point.
          if (attempt === 0) {
            setStatus("error");
            setMessage(data.message || "Order verification failed.");
          }
          return;
        }

        setStatus("success");
        setOrderInfo(data);

        // The payment is confirmed either way — keep checking quietly in the
        // background only until the delivery outcome is known.
        if (data.dispatchPending && attempt + 1 < MAX_POLLS) {
          timer = setTimeout(() => verify(attempt + 1), POLL_INTERVAL_MS);
        }
      } catch {
        if (cancelled || attempt > 0) return;
        setStatus("error");
        setMessage("Network error. Please contact the restaurant.");
      }
    };

    verify(0);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#FBF8F1] flex items-center justify-center px-4 pt-20">
        <div className="max-w-md w-full text-center bg-white rounded-2xl p-8 md:p-12 shadow-lg border border-gray-100">
          <Loader2 className="w-16 h-16 text-[#5C1A1B] mx-auto mb-6 animate-spin" />
          <h1 className="text-2xl font-bold text-[#5C1A1B] mb-2">
            Verifying your order...
          </h1>
          <p className="text-gray-500 text-sm">
            Please wait while we confirm your payment.
          </p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen bg-[#FBF8F1] flex items-center justify-center px-4 pt-20">
        <div className="max-w-md w-full text-center bg-white rounded-2xl p-8 md:p-12 shadow-lg border border-gray-100">
          <CheckCircle className="w-16 h-16 text-yellow-500 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-[#5C1A1B] mb-2">
            Order Status Unknown
          </h1>
          <p className="text-gray-500 mb-6">{message}</p>
          <div className="space-y-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 w-full px-6 py-3 bg-[#5C1A1B] hover:bg-[#7A2526] text-white font-semibold rounded-lg transition-colors"
            >
              <Home className="w-5 h-5" />
              Back to Home
            </Link>
            <a
              href="tel:978-897-9227"
              className="block text-sm text-gray-500 hover:text-[#5C1A1B] transition-colors"
            >
              Questions? Call us at (978) 897-9227
            </a>
          </div>
        </div>
      </div>
    );
  }

  const isDelivery = orderInfo?.isDelivery;
  const deliveryType = orderInfo?.deliveryType;
  const hasUberTracking = deliveryType === "asap" && !!orderInfo?.uberDeliveryId;
  const isScheduled = deliveryType === "scheduled";
  const isManual = deliveryType === "manual_fallback";
  // No outcome yet — say nothing definite. Better to leave this on screen than to
  // claim a manual delivery for an order whose driver is being assigned.
  const isDispatchPending = !!orderInfo?.dispatchPending;

  const etaString = orderInfo?.dropoffEta
    ? new Date(orderInfo.dropoffEta).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "America/New_York",
      })
    : null;

  // scheduledFor is a UTC ISO string; show it in restaurant-local time (ET)
  // rather than the viewer's timezone. Guard against legacy rows that stored a
  // human-readable string new Date() can't parse.
  const scheduledDate = orderInfo?.scheduledFor ? new Date(orderInfo.scheduledFor) : null;
  const scheduledString = scheduledDate
    ? isNaN(scheduledDate.getTime())
      ? orderInfo?.scheduledFor ?? null
      : scheduledDate.toLocaleString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZone: "America/New_York",
          timeZoneName: "short",
        })
    : null;

  return (
    <div className="min-h-screen bg-[#FBF8F1] flex items-center justify-center px-4 pt-20">
      <div className="max-w-md w-full text-center bg-white rounded-2xl p-8 md:p-12 shadow-lg border border-gray-100">
        <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-6" />
        <h1 className="text-3xl font-bold text-[#5C1A1B] mb-3">
          Order Confirmed!
        </h1>
        <p className="text-gray-600 mb-2">
          Thank you for your order. Your payment was successful.
        </p>
        <p className="text-gray-500 text-sm mb-6">
          We&apos;re preparing your food now. You&apos;ll receive a confirmation email shortly.
        </p>

        {/* Delivery info block */}
        {isDelivery && (
          <div className="bg-[#FBF8F1] rounded-xl p-5 mb-6 text-left border border-[#C4973B]/20">

            {/* SCHEDULED — driver not dispatched yet */}
            {isScheduled && (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-5 h-5 text-[#C4973B]" />
                  <span className="font-semibold text-[#5C1A1B]">Order Scheduled</span>
                </div>
                {scheduledString && (
                  <p className="text-sm text-gray-600 mb-1">
                    Your delivery is scheduled for{" "}
                    <span className="font-semibold text-[#5C1A1B]">{scheduledString}</span>
                  </p>
                )}
                <p className="text-sm text-gray-500">
                  A driver will be dispatched closer to your scheduled time. You can check back on this page for live tracking once a driver is assigned.
                </p>
              </>
            )}

            {/* ASAP — Uber driver dispatched (or scheduled order that cron has dispatched) */}
            {hasUberTracking && (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <Truck className="w-5 h-5 text-[#C4973B]" />
                  <span className="font-semibold text-[#5C1A1B]">Driver is on the way!</span>
                </div>
                <div className="space-y-2">
                  {etaString && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="w-4 h-4 text-[#C4973B]" />
                      <span>
                        Estimated delivery:{" "}
                        <span className="font-semibold text-[#5C1A1B]">{etaString}</span>
                      </span>
                    </div>
                  )}
                  {orderInfo?.trackingUrl && (
                    <a
                      href={orderInfo.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-[#C4973B] hover:text-[#5C1A1B] font-medium transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Track your delivery
                    </a>
                  )}
                </div>
              </>
            )}

            {/* DISPATCH PENDING — payment is confirmed, courier not resolved yet */}
            {isDispatchPending && (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <Loader2 className="w-5 h-5 text-[#C4973B] animate-spin" />
                  <span className="font-semibold text-[#5C1A1B]">Arranging your delivery</span>
                </div>
                <p className="text-sm text-gray-500">
                  Your payment went through and the kitchen has your order. We&apos;re
                  assigning a driver now — tracking will appear here in a moment.
                </p>
              </>
            )}

            {/* MANUAL FALLBACK — Uber failed, restaurant delivers manually */}
            {isManual && (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <Info className="w-5 h-5 text-amber-500" />
                  <span className="font-semibold text-[#5C1A1B]">Delivery Arranged</span>
                </div>
                <p className="text-sm text-gray-500">
                  We&apos;ll deliver your order manually. If you have any questions, please call us.
                </p>
              </>
            )}
          </div>
        )}

        <div className="space-y-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 w-full px-6 py-3 bg-[#5C1A1B] hover:bg-[#7A2526] text-white font-semibold rounded-lg transition-colors"
          >
            <Home className="w-5 h-5" />
            Back to Home
          </Link>
          <a
            href="tel:978-897-9227"
            className="block text-sm text-gray-500 hover:text-[#5C1A1B] transition-colors"
          >
            Questions? Call us at (978) 897-9227
          </a>
        </div>
      </div>
    </div>
  );
}