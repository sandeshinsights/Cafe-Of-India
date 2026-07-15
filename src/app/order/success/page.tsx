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
}

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

    fetch("/api/verify-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    })
      .then((res) => res.json())
      .then((data: VerifyResult) => {
        if (data.success) {
          setStatus("success");
          setOrderInfo(data);
        } else {
          setStatus("error");
          setMessage(data.message || "Order verification failed.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Network error. Please contact the restaurant.");
      });
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

  const etaString = orderInfo?.dropoffEta
    ? new Date(orderInfo.dropoffEta).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "America/New_York",
      })
    : null;

  const scheduledString = orderInfo?.scheduledFor
    ? new Date(orderInfo.scheduledFor).toLocaleString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
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