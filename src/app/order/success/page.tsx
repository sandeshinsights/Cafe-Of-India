"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle, Home, Loader2 } from "lucide-react";

export default function OrderSuccess() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

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
      .then((data) => {
        if (data.success) {
          setStatus("success");
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
        <p className="text-gray-500 text-sm mb-8">
          We&apos;re preparing your food now. You&apos;ll receive a confirmation email shortly.
        </p>
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