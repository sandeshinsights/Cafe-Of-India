"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { getMenuData } from "@/lib/data";
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  X,
  ChevronRight,
  Clock,
} from "lucide-react";

/* ─── types ─── */

interface CartItem {
  id: string;
  name: string;
  basePrice: number;
  totalPrice: number;
  protein?: string;
  surcharge?: number;
  spiceLevel?: string;
  specialInstructions?: string;
  quantity: number;
}

/* ─── constants ─── */

const PROTEIN_OPTIONS = [
  { name: "Chicken", surcharge: 2.0 },
  { name: "Mutton", surcharge: 2.0 },
  { name: "Lamb", surcharge: 2.0 },
  { name: "Shrimp", surcharge: 2.0 },
];

function isDinnerCategory(name: string): boolean {
  return name.toLowerCase() === "dinner";
}

function isSpicyCategory(name: string): boolean {
  const spicy = [
    "Dinner",
    "Indo Chinese",
    "Vegetarian",
    "Rice Specialties",
    "Tandoori Specials",
    "Cafe Specials",
  ];
  return spicy.some((c) => c.toLowerCase() === name.toLowerCase());
}

/* ─── component ─── */

export default function Menu() {
  const menuData = getMenuData();
  const categories = menuData.categories;
  /* state */
  const [selectedCategory, setSelectedCategory] = useState(
    categories[0]?.id || ""
  );
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  /* item‑level form state */
  const [selectedProtein, setSelectedProtein] = useState("");
  const [selectedSpice, setSelectedSpice] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [quantity, setQuantity] = useState(1);

  /* cart */
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);

  /* checkout form */
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  /* derived */
  const activeCategory = useMemo(
    () => categories.find((cat: { id: string }) => cat.id === selectedCategory),
    [categories, selectedCategory]
  );

  const cartTotal = cart.reduce(
    (sum, item) => sum + item.totalPrice * item.quantity,
    0
  );
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  /* ─── helpers ─── */

  function resetForm() {
    setSelectedProtein("");
    setSelectedSpice("");
    setSpecialInstructions("");
    setQuantity(1);
  }

  function handleToggleExpand(itemId: string) {
    if (expandedItemId === itemId) {
      setExpandedItemId(null);
      resetForm();
    } else {
      setExpandedItemId(itemId);
      resetForm();
    }
  }

  function handleAddToCart(item: any, categoryName: string) {
    const isDin = isDinnerCategory(categoryName);
    const isSpicy = isSpicyCategory(categoryName);

    if (isDin && !selectedProtein) return;
    if (isSpicy && !selectedSpice) return;

    const proteinObj = isDin
      ? PROTEIN_OPTIONS.find((p) => p.name === selectedProtein)
      : null;
    const surcharge = proteinObj ? proteinObj.surcharge : 0;

    const cartItem: CartItem = {
      id: `${item.id}-${selectedProtein || "none"}-${
        selectedSpice || "none"
      }-${Date.now()}`,
      name: selectedProtein ? `${selectedProtein} ${item.name}` : item.name,
      basePrice: item.price,
      totalPrice: item.price + surcharge,
      protein: selectedProtein || undefined,
      surcharge: surcharge || undefined,
      spiceLevel: selectedSpice || undefined,
      specialInstructions: specialInstructions.trim() || undefined,
      quantity: quantity,
    };

    setCart((prev) => [...prev, cartItem]);
    setExpandedItemId(null);
    resetForm();
  }

  function handleUpdateQuantity(cartItemId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((item) =>
          item.id === cartItemId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function handleRemoveFromCart(cartItemId: string) {
    setCart((prev) => prev.filter((item) => item.id !== cartItemId));
  }

  /* ─── checkout ─── */

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
    if (cart.length === 0) return;

    setIsCheckingOut(true);
    setCheckoutError("");

    try {
      const subtotal = cart.reduce(
        (sum, item) => sum + item.totalPrice * item.quantity,
        0
      );
      const tax = subtotal * 0.07;
      const total = subtotal + tax;

      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: customerName.trim(),
          email: customerEmail.trim(),
          phone: customerPhone.trim(),
          items: cart.map((ci) => ({
            id: ci.id,
            name: ci.name,
            price: ci.totalPrice,
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
        window.location.href = data.url;
      } else {
        setCheckoutError(data.error || "Checkout failed. Please try again.");
      }
    } catch (error) {
      setCheckoutError(
        "Network error. Please check your connection and try again."
      );
    } finally {
      setIsCheckingOut(false);
    }
  }

  /* ─── render ─── */

  return (
    <section id="menu" className="py-16 px-4 bg-[#FBF8F1]">
      <div className="max-w-6xl mx-auto">
        {/* heading */}
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-[#5C1A1B] mb-3">
            Our Menu
          </h2>
          <p className="text-[#C4973B] text-lg">
            Authentic Indian flavors, made fresh daily
          </p>
        </div>

        {/* category tabs */}
        <div className="flex flex-wrap gap-2 mb-8 justify-center">
          {categories.map((cat: any) => (
            <button
              key={cat.id}
              onClick={() => {
                setSelectedCategory(cat.id);
                setExpandedItemId(null);
                resetForm();
              }}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedCategory === cat.id
                  ? "bg-[#5C1A1B] text-white"
                  : "bg-white text-[#5C1A1B] border border-[#5C1A1B]/20 hover:bg-[#5C1A1B]/5"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* menu items + cart toggle */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-[#5C1A1B]">
            {activeCategory?.name}
          </h3>
          <button
            onClick={() => setCartOpen(true)}
            className="relative flex items-center gap-2 bg-[#5C1A1B] text-white px-4 py-2 rounded-lg hover:bg-[#7A2526] transition-colors"
          >
            <ShoppingCart className="w-5 h-5" />
            Cart
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-[#C4973B] text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                {cartCount}
              </span>
            )}
          </button>
        </div>

        {/* items list */}
        <div className="space-y-3">
          {activeCategory?.items?.map((item: any) => {
            const isExpanded = expandedItemId === item.id;
            const isDin = isDinnerCategory(activeCategory.name);
            const isSpicy = isSpicyCategory(activeCategory.name);
            const canAdd =
              (!isDin || selectedProtein) && (!isSpicy || selectedSpice);

            return (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
              >
                {/* header row */}
                <button
                  onClick={() => handleToggleExpand(item.id)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-[#5C1A1B] text-base truncate">
                      {item.name}
                    </h4>
                    {item.description && (
                      <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">
                        {item.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 ml-3 shrink-0">
                    <span className="font-bold text-[#C4973B]">
                      ${item.price.toFixed(2)}
                    </span>
                    <ChevronRight
                      className={`w-4 h-4 text-gray-400 transition-transform ${
                        isExpanded ? "rotate-90" : ""
                      }`}
                    />
                  </div>
                </button>

                {/* expanded details */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-4">
                    {/* description (full) */}
                    {item.description && (
                      <p className="text-sm text-gray-600">
                        {item.description}
                      </p>
                    )}

                    {/* ── Choose Style (Dinner only) ── */}
                    {isDin && (
                      <div>
                        <p className="text-sm font-semibold text-[#5C1A1B] mb-2">
                          Choose Style{" "}
                          <span className="text-red-500">*</span>
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {PROTEIN_OPTIONS.map((p) => (
                            <button
                              key={p.name}
                              type="button"
                              onClick={() => setSelectedProtein(p.name)}
                              className={`px-3 py-2 rounded-lg text-sm border transition-all ${
                                selectedProtein === p.name
                                  ? "border-[#5C1A1B] bg-[#5C1A1B]/10 text-[#5C1A1B] font-medium"
                                  : "border-gray-200 text-gray-700 hover:border-gray-300"
                              }`}
                            >
                              {p.name}
                              {p.surcharge > 0 && (
                                <span className="text-xs text-[#C4973B] ml-1">
                                  +${p.surcharge.toFixed(2)}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ── Spicy Level (6 categories) ── */}
                    {isSpicy && (
                      <div>
                        <p className="text-sm font-semibold text-[#5C1A1B] mb-2">
                          Spicy Level{" "}
                          <span className="text-red-500">*</span>
                        </p>
                        <div className="flex gap-2">
                          {["Mild", "Medium", "Spicy"].map((level) => (
                            <button
                              key={level}
                              type="button"
                              onClick={() => setSelectedSpice(level)}
                              className={`flex-1 px-3 py-2 rounded-lg text-sm border transition-all ${
                                selectedSpice === level
                                  ? "border-[#5C1A1B] bg-[#5C1A1B]/10 text-[#5C1A1B] font-medium"
                                  : "border-gray-200 text-gray-700 hover:border-gray-300"
                              }`}
                            >
                              {level}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ── Special Instructions ── */}
                    <div>
                      <p className="text-sm font-semibold text-[#5C1A1B] mb-2">
                        Special Instructions
                      </p>
                      <textarea
                        value={specialInstructions}
                        onChange={(e) => setSpecialInstructions(e.target.value)}
                        placeholder="Any allergies or preferences?"
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#C4973B]/50 focus:border-[#C4973B]"
                      />
                    </div>

                    {/* ── Quantity ── */}
                    <div>
                      <p className="text-sm font-semibold text-[#5C1A1B] mb-2">
                        Quantity
                      </p>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            setQuantity((q) => Math.max(1, q - 1))
                          }
                          className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 hover:bg-gray-100"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-sm font-medium w-8 text-center">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQuantity((q) => q + 1)}
                          className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 hover:bg-gray-100"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        {selectedProtein && (
                          <span className="text-sm text-[#C4973B] font-medium">
                            Total: $                             {(item.price +
                              (PROTEIN_OPTIONS.find(
                                (p) => p.name === selectedProtein
                              )?.surcharge || 0) * quantity).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* add to cart */}
                    <button
                      type="button"
                      onClick={() => handleAddToCart(item, activeCategory.name)}
                      disabled={!canAdd}
                      className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        canAdd
                          ? "bg-[#5C1A1B] text-white hover:bg-[#7A2526] shadow-sm"
                          : "bg-gray-200 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      <ShoppingCart className="w-4 h-4" />
                      Add to Cart
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* pickup notice */}
        <div className="mt-8 text-center text-sm text-gray-500 flex items-center justify-center gap-2">
          <Clock className="w-4 h-4" />
          Pickup only &middot; 7% MA tax &middot; Last order at 7:00 PM
        </div>
      </div>

      {/* ═══════ Cart Drawer ═══════ */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setCartOpen(false)}
          />
          {/* panel */}
          <div className="relative w-full max-w-md bg-[#FBF8F1] shadow-2xl flex flex-col">
            {/* drawer header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-[#5C1A1B]">
                Your Order ({cartCount})
              </h3>
              <button
                onClick={() => setCartOpen(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* cart items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (
                <p className="text-center text-gray-500 py-10">
                  Your cart is empty
                </p>
              ) : (
                cart.map((ci) => (
                  <div
                    key={ci.id}
                    className="bg-white rounded-lg border border-gray-100 p-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#5C1A1B] truncate">
                          {ci.name}
                        </p>
                        {ci.protein && (
                          <p className="text-xs text-gray-500">
                            Style: {ci.protein}
                          </p>
                        )}
                        {ci.spiceLevel && (
                          <p className="text-xs text-gray-500">
                            Spice: {ci.spiceLevel}
                          </p>
                        )}
                        {ci.specialInstructions && (
                          <p className="text-xs text-gray-400 italic">
                            {ci.specialInstructions}
                          </p>
                        )}
                        <p className="text-sm font-bold text-[#C4973B] mt-1">
                          ${(ci.totalPrice * ci.quantity).toFixed(2)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(ci.id, -1)}
                          className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-300 hover:bg-gray-100"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-sm font-medium w-6 text-center">
                          {ci.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(ci.id, 1)}
                          className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-300 hover:bg-gray-100"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveFromCart(ci.id)}
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

            {/* checkout area */}
            {cart.length > 0 && (
              <>
                <div className="p-4 border-t border-gray-200 space-y-3">
                  {/* totals */}
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between text-gray-600">
                      <span>Subtotal</span>
                      <span>${cartTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Tax (7%)</span>
                      <span>${(cartTotal * 0.07).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-[#5C1A1B] text-base pt-1 border-t border-gray-200">
                      <span>Total</span>
                      <span>${(cartTotal * 1.07).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* customer form */}
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
                    <p className="text-red-500 text-sm text-center">
                      {checkoutError}
                    </p>
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
                      : `Pay $${(cartTotal * 1.07).toFixed(2)} with Stripe`}
                  </button>
                  <p className="text-xs text-center text-gray-400">
                    Pickup only &middot; 7% MA tax &middot; Secure payment by Stripe
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}