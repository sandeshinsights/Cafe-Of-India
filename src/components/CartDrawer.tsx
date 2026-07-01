"use client";

import { useState } from "react";
import { X, Plus, Minus, Trash2, ShoppingBag, ArrowLeft, Truck, MapPin, Tag, XCircle } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { isOrderingWindowOpen, getOrderingClosedReason, formatMinutesTo12h } from "@/lib/ordering-hours";
import TimeSlotPicker from "./TimeSlotPicker";

interface AppliedPromo {
  promoCodeId: string;
  discountType: string;
  discountValue: number;
  description: string;
  message: string;
}

export default function CartDrawer() {
  const {
    items,
    removeItem,
    updateQuantity,
    subtotal,
    tax,
    total,
    itemCount,
    isCartOpen,
    closeCart,
    clearCart,
  } = useCart();

  const [step, setStep] = useState<"review" | "fulfillment" | "checkout">("review");

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  // Promo code state
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);
  const [promoError, setPromoError] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);

  // Scheduling state
  const [orderMode, setOrderMode] = useState<"now" | "scheduled">("now");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);

  // Tip state
  const [selectedTip, setSelectedTip] = useState<string>("none");
  const [customTipInput, setCustomTipInput] = useState("");

  const handleClose = () => {
    closeCart();
    setTimeout(() => {
      setStep("review");
      setPromoInput("");
      setAppliedPromo(null);
      setPromoError("");
      setOrderMode("now");
      setSelectedDate(null);
      setSelectedTimeSlot(null);
      setSelectedTip("none");
      setCustomTipInput("");
    }, 300);
  };

  // Calculate discount
  const discountAmount = appliedPromo
    ? parseFloat(
        appliedPromo.discountType === "PERCENTAGE"
          ? (subtotal * appliedPromo.discountValue / 100).toFixed(2)
          : Math.min(appliedPromo.discountValue, subtotal).toFixed(2)
      )
    : 0;

  const discountedSubtotal = parseFloat((subtotal - discountAmount).toFixed(2));
  const discountTax = parseFloat((discountedSubtotal * 0.07).toFixed(2));
  const discountTotal = parseFloat((discountedSubtotal + discountTax).toFixed(2));

  const displaySubtotal = appliedPromo ? discountedSubtotal : subtotal;
  const displayTax = appliedPromo ? discountTax : tax;
  const displayTotal = appliedPromo ? discountTotal : total;

  // Calculate tip
  const tipAmount = selectedTip === "custom"
    ? Math.max(0, parseFloat(customTipInput) || 0)
    : selectedTip === "none"
    ? 0
    : parseFloat((displaySubtotal * parseFloat(selectedTip) / 100).toFixed(2));

  const finalTotal = parseFloat((displayTotal + tipAmount).toFixed(2));

  const orderingAvailable = isOrderingWindowOpen();

  const scheduledDisplayLabel =
    orderMode === "scheduled" && selectedDate && selectedTimeSlot
      ? `${selectedDate.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          timeZone: "America/New_York",
        })} at ${formatMinutesTo12h(
          parseInt(selectedTimeSlot.split(":")[0]) * 60 +
            parseInt(selectedTimeSlot.split(":")[1])
        )}`
      : null;

  async function handleApplyPromo() {
    if (!promoInput.trim()) return;
    if (!customerEmail.trim() || !customerEmail.includes("@")) {
      setPromoError("Enter your email first to apply a promo code");
      return;
    }

    setPromoLoading(true);
    setPromoError("");

    try {
      const res = await fetch("/api/promo/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: promoInput.trim(),
          email: customerEmail.trim(),
        }),
      });

      const data = await res.json();

      if (data.valid) {
        setAppliedPromo({
          promoCodeId: data.promoCodeId,
          discountType: data.discountType,
          discountValue: data.discountValue,
          description: data.description,
          message: data.message,
        });
        setPromoError("");
      } else {
        setAppliedPromo(null);
        setPromoError(data.message || "Invalid promo code");
      }
    } catch {
      setPromoError("Network error. Try again.");
    } finally {
      setPromoLoading(false);
    }
  }

  function handleRemovePromo() {
    setAppliedPromo(null);
    setPromoInput("");
    setPromoError("");
  }

  async function handleCheckout() {
    if (!customerName.trim()) {
      setCheckoutError("Please enter your name");
      return;
    }
    if (!customerEmail.trim() || !customerEmail.includes("@")) {
      setCheckoutError("Please enter a valid email");
      return;
    }
    if (!customerPhone.trim() || customerPhone.length < 7) {
      setCheckoutError("Please enter a valid phone number");
      return;
    }
    if (items.length === 0) return;

    setIsCheckingOut(true);
    setCheckoutError("");

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: customerName.trim(),
          email: customerEmail.trim(),
          phone: customerPhone.trim(),
          items: items.map((ci) => ({
            id: ci.id,
            name: ci.name,
            price: ci.price,
            quantity: ci.quantity,
            protein: ci.protein || undefined,
            spicyLevel: ci.spiceLevel || undefined,
            specialInstructions: ci.specialInstructions || undefined,
          })),
          promoCodeId: appliedPromo?.promoCodeId || undefined,
          tipAmount: tipAmount > 0 ? tipAmount : undefined,
          ...(orderMode === "scheduled" && selectedDate && selectedTimeSlot
            ? {
                scheduledDate: selectedDate.toLocaleDateString("en-CA", {
                  timeZone: "America/New_York",
                }),
                scheduledTime: selectedTimeSlot,
              }
            : {}),
        }),
      });

      const data = await response.json();
      if (data.url) {
        clearCart();
        window.location.href = data.url;
      } else {
        setCheckoutError(data.error || "Checkout failed. Please try again.");
      }
    } catch {
      setCheckoutError(
        "Network error. Please check your connection and try again."
      );
    } finally {
      setIsCheckingOut(false);
    }
  }

  if (!isCartOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

      {/* panel */}
      <div className="relative w-full max-w-md bg-[#FBF8F1] shadow-2xl flex flex-col">
        {/* header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-2">
            {step !== "review" && (
              <button
                onClick={() => {
                  if (step === "checkout") setStep("fulfillment");
                  else setStep("review");
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
            )}
            <h3 className="text-lg font-bold text-[#5C1A1B] flex items-center gap-2">
              <ShoppingBag className="w-5 h-5" />
              {step === "review" && `Your Cart (${itemCount})`}
              {step === "fulfillment" && "Choose Pickup or Delivery"}
              {step === "checkout" && "Checkout Details"}
            </h3>
          </div>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Step 1: Cart items review + order timing choice */}
        {step === "review" && (
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
            <div className="p-4 space-y-3">
              {items.length === 0 ? (
                <div className="text-center py-16">
                  <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">Your cart is empty</p>
                  <p className="text-gray-400 text-sm mt-1">
                    Add items from the menu to get started
                  </p>
                </div>
              ) : (
                items.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-lg border border-gray-100 p-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#5C1A1B] truncate">
                          {item.name}
                        </p>
                        {item.protein && (
                          <p className="text-xs text-gray-500">
                            Style: {item.protein}
                          </p>
                        )}
                        {item.spiceLevel && (
                          <p className="text-xs text-gray-500">
                            Spice: {item.spiceLevel}
                          </p>
                        )}
                        {item.specialInstructions && (
                          <p className="text-xs text-gray-400 italic">
                            {item.specialInstructions}
                          </p>
                        )}
                        <p className="text-sm font-bold text-[#C4973B] mt-1">
                          ${(item.price * item.quantity).toFixed(2)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-2 shrink-0">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-300 hover:bg-gray-100"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-sm font-medium w-6 text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-300 hover:bg-gray-100"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="ml-1 p-1 text-red-400 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {items.length > 0 && (
              <div className="p-4 border-t border-gray-200 space-y-3">
                {/* Totals */}
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Tax (7%)</span>
                    <span>${tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-[#5C1A1B] text-base pt-1 border-t border-gray-200">
                    <span>Total</span>
                    <span>${total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Outside ordering hours warning */}
                {!orderingAvailable && (
                  <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 text-center">
                    {getOrderingClosedReason()}. You can schedule for a later time.
                  </p>
                )}

                {/* Order timing choice */}
                <div className="space-y-2">
                  <label
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      orderMode === "now"
                        ? "border-[#5C1A1B] bg-[#5C1A1B]/5"
                        : "border-gray-200 hover:border-gray-300"
                    } ${!orderingAvailable ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <input
                      type="radio"
                      name="orderMode"
                      checked={orderMode === "now"}
                      onChange={() => setOrderMode("now")}
                      disabled={!orderingAvailable}
                      className="accent-[#5C1A1B]"
                    />
                    <div>
                      <p className="text-sm font-medium text-[#5C1A1B]">Order Now</p>
                      <p className="text-xs text-gray-500">
                        {orderingAvailable
                          ? "Ready in 25-40 minutes"
                          : getOrderingClosedReason()}
                      </p>
                    </div>
                  </label>

                  <label
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      orderMode === "scheduled"
                        ? "border-[#C4973B] bg-[#C4973B]/5"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="orderMode"
                      checked={orderMode === "scheduled"}
                      onChange={() => setOrderMode("scheduled")}
                      className="accent-[#C4973B]"
                    />
                    <div>
                      <p className="text-sm font-medium text-[#5C1A1B]">Schedule for Later</p>
                      <p className="text-xs text-gray-500">Pick a future date and time</p>
                    </div>
                  </label>
                </div>

                {/* Time picker (only when "Schedule for Later" selected) */}
                {orderMode === "scheduled" && (
                  <TimeSlotPicker
                    selectedDate={selectedDate}
                    onDateChange={setSelectedDate}
                    selectedTime={selectedTimeSlot}
                    onTimeChange={setSelectedTimeSlot}
                  />
                )}

                {/* Continue button */}
                <button
                  disabled={
                    (orderMode === "now" && !orderingAvailable) ||
                    (orderMode === "scheduled" && (!selectedDate || !selectedTimeSlot))
                  }
                  onClick={() => setStep("fulfillment")}
                  className={`w-full font-bold py-3 rounded-lg transition-colors ${
                    (orderMode === "now" && !orderingAvailable) ||
                    (orderMode === "scheduled" && (!selectedDate || !selectedTimeSlot))
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : "bg-[#C4973B] text-white hover:bg-[#d4a84b]"
                  }`}
                >
                  {orderMode === "scheduled" && (!selectedDate || !selectedTimeSlot)
                    ? "Select date & time"
                    : "Continue"}
                </button>

                <p className="text-xs text-center text-gray-400">
                  7% MA sales tax applies &middot; Secure payment by Stripe
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Pickup or Delivery selection */}
        {step === "fulfillment" && (
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col items-center justify-center p-6 space-y-4">
            {orderMode === "scheduled" && scheduledDisplayLabel && (
              <div className="w-full bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                <p className="text-xs font-medium text-amber-800">Scheduled Pickup</p>
                <p className="text-sm text-amber-700 font-medium">{scheduledDisplayLabel}</p>
              </div>
            )}

            <button
              onClick={() => setStep("checkout")}
              className="w-full border-2 border-[#5C1A1B] rounded-xl p-6 text-center hover:bg-[#5C1A1B]/5 transition-colors cursor-pointer group"
            >
              <MapPin className="w-10 h-10 text-[#5C1A1B] mx-auto mb-3" />
              <p className="text-lg font-bold text-[#5C1A1B]">Pickup</p>
              <p className="text-sm text-gray-500 mt-1">
                155 Main St, Maynard, MA 01754
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {orderMode === "scheduled"
                  ? `Scheduled for ${scheduledDisplayLabel}`
                  : "Ready in 25-40 minutes"}
              </p>
            </button>

            <div className="w-full border-2 border-gray-200 rounded-xl p-6 text-center opacity-50 cursor-not-allowed bg-gray-50 relative">
              <Truck className="w-10 h-10 text-gray-400 mx-auto mb-3" />
              <p className="text-lg font-bold text-gray-400">Delivery</p>
              <p className="text-sm text-gray-400 mt-1">
                Coming soon
              </p>
              <span className="absolute top-3 right-3 text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">
                Soon
              </span>
            </div>

            <p className="text-xs text-center text-gray-400">
              7% MA sales tax applies &middot; Secure payment by Stripe
            </p>
          </div>
        )}

        {/* Step 3: Customer form + Pay */}
        {step === "checkout" && (
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 border-t border-gray-200 space-y-3">
            {/* Price breakdown */}
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span className={appliedPromo ? "line-through text-gray-400" : ""}>
                  ${subtotal.toFixed(2)}
                </span>
              </div>
              {appliedPromo && (
                <div className="flex justify-between text-green-600">
                  <span className="flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    Discount ({appliedPromo.message})
                  </span>
                  <span>-${discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-600">
                <span>Tax (7%)</span>
                <span>${displayTax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-[#5C1A1B] text-base pt-1 border-t border-gray-200">
                <span>Total</span>
                <span>${displayTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Tip / Gratuity */}
            <div className="border border-gray-200 rounded-lg p-3 space-y-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Tip / Gratuity</p>
              <div className="grid grid-cols-5 gap-1.5">
                {["10", "15", "20", "25"].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => { setSelectedTip(pct); setCustomTipInput(""); }}
                    className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedTip === pct
                        ? "bg-[#5C1A1B] text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => { setSelectedTip("none"); setCustomTipInput(""); }}
                  className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedTip === "none"
                      ? "bg-gray-300 text-gray-700"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  No Tip
                </button>
                <button
                  onClick={() => setSelectedTip("custom")}
                  className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedTip === "custom"
                      ? "bg-[#5C1A1B] text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Custom
                </button>
              </div>
              {selectedTip === "custom" && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.50"
                    placeholder="0.00"
                    value={customTipInput}
                    onChange={(e) => setCustomTipInput(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C4973B]/50 focus:border-[#C4973B]"
                  />
                </div>
              )}
              {tipAmount > 0 && (
                <p className="text-xs text-gray-500 text-center">
                  Tip: ${tipAmount.toFixed(2)} &middot; Grand Total: ${finalTotal.toFixed(2)}
                </p>
              )}
            </div>

            {/* Scheduled order info */}
            {scheduledDisplayLabel && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs font-medium text-amber-800">Scheduled Pickup</p>
                <p className="text-sm text-amber-700 font-medium">{scheduledDisplayLabel}</p>
              </div>
            )}

            {/* Promo code section */}
            <div className="border border-gray-200 rounded-lg p-3 space-y-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Promo Code</p>
              {appliedPromo ? (
                <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <div>
                    <span className="text-sm font-medium text-green-700">{appliedPromo.message}</span>
                    <p className="text-xs text-green-600">{appliedPromo.description}</p>
                  </div>
                  <button onClick={handleRemovePromo} className="text-green-600 hover:text-green-800">
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter code"
                    value={promoInput}
                    onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); setPromoError(""); }}
                    onKeyDown={(e) => e.key === "Enter" && handleApplyPromo()}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C4973B]/50 focus:border-[#C4973B] uppercase"
                  />
                  <button
                    onClick={handleApplyPromo}
                    disabled={promoLoading || !promoInput.trim()}
                    className="px-4 py-2 bg-[#5C1A1B] text-white text-sm font-medium rounded-lg hover:bg-[#6d2a2b] transition-colors disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
                  >
                    {promoLoading ? "..." : "Apply"}
                  </button>
                </div>
              )}
              {promoError && (
                <p className="text-xs text-red-500">{promoError}</p>
              )}
            </div>

            {/* Customer info form */}
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Your name *"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C4973B]/50 focus:border-[#C4973B]"
              />
              <input
                type="email"
                placeholder="Email *"
                value={customerEmail}
                onChange={(e) => { setCustomerEmail(e.target.value); if (appliedPromo) { setAppliedPromo(null); setPromoError("Promo removed — re-apply after changing email"); } }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C4973B]/50 focus:border-[#C4973B]"
              />
              <input
                type="tel"
                placeholder="Phone *"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C4973B]/50 focus:border-[#C4973B]"
              />
            </div>

            {checkoutError && (
              <p className="text-red-500 text-sm text-center">{checkoutError}</p>
            )}

            <button
              disabled={
                isCheckingOut ||
                !customerName.trim() ||
                !customerEmail.trim() ||
                !customerPhone.trim()
              }
              onClick={handleCheckout}
              className={`w-full font-bold py-3 rounded-lg transition-colors ${
                isCheckingOut ||
                !customerName.trim() ||
                !customerEmail.trim() ||
                !customerPhone.trim()
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-[#C4973B] text-white hover:bg-[#d4a84b]"
              }`}
            >
              {isCheckingOut
                ? "Processing..."
                : `Pay $${finalTotal.toFixed(2)} with Stripe`}
            </button>
            <p className="text-xs text-center text-gray-400">
              {orderMode === "scheduled" ? "Scheduled pickup" : "Pickup only"} &middot; 7% MA tax &middot; Secure payment by Stripe
            </p>
          </div>
        )}
      </div>
    </div>
  );
}