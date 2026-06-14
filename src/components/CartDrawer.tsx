"use client";

import { useState } from "react";
import { X, Plus, Minus, Trash2, ShoppingBag, ArrowLeft, Truck, MapPin } from "lucide-react";
import { useCart } from "@/context/CartContext";

function isOrderingAvailable(): boolean {
  const now = new Date();
  const etTime = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" })
  );
  const hours = etTime.getHours();
  const minutes = etTime.getMinutes();
  const totalMinutes = hours * 60 + minutes;
  // 11:15 AM = 675, 8:45 PM = 1305
  return totalMinutes >= 675 && totalMinutes <= 1305;
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

  const handleClose = () => {
    closeCart();
    setTimeout(() => setStep("review"), 300);
  };

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
          subtotal,
          tax,
          total,
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

  const orderingAvailable = isOrderingAvailable();

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

      {/* panel */}
      <div className="relative w-full max-w-md bg-[#FBF8F1] shadow-2xl flex flex-col">
        {/* header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            {step !== "review" && (
              <button
                onClick={() => setStep(step === "fulfillment" ? "review" : "fulfillment")}
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

        {/* Step 1: Cart items review */}
        {step === "review" && (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
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

                {!orderingAvailable ? (
                  <div className="text-center">
                    <button
                      disabled
                      className="w-full font-bold py-3 rounded-lg bg-gray-300 text-gray-500 cursor-not-allowed"
                    >
                      Ordering Unavailable
                    </button>
                    <p className="text-sm text-gray-500 mt-2">
                      Orders are accepted between <strong>11:15 AM - 8:45 PM</strong>
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={() => setStep("fulfillment")}
                    className="w-full font-bold py-3 rounded-lg bg-[#C4973B] text-white hover:bg-[#d4a84b] transition-colors"
                  >
                    Proceed to Checkout
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {/* Step 2: Pickup or Delivery selection */}
        {step === "fulfillment" && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-4">
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
                Ready in 25-40 minutes
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
          <div className="p-4 border-t border-gray-200 space-y-3">
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
                onChange={(e) => setCustomerEmail(e.target.value)}
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
                : `Pay $${total.toFixed(2)} with Stripe`}
            </button>
            <p className="text-xs text-center text-gray-400">
              Pickup only &middot; 7% MA tax &middot; Secure payment by Stripe
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
















