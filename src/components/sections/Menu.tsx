"use client";

import { useState, useMemo } from "react";
import { getMenuData } from "@/lib/data";
import type { MenuItem } from "@/lib/types";
import {
  ChevronDown,
  ChevronUp,
  ShoppingCart,
  Plus,
  Minus,
  X,
} from "lucide-react";

const PROTEIN_OPTIONS = [
  { name: "Chicken", surcharge: 0 },
  { name: "Lamb", surcharge: 2.0 },
  { name: "Goat", surcharge: 2.0 },
  { name: "Shrimp", surcharge: 2.0 },
] as const;

const SPICE_LEVELS = ["Mild", "Medium", "Spicy"] as const;

const tagConfig: Record<string, { label: string; color: string; icon?: React.ReactNode }> = {
  GF: { label: "GF", color: "bg-green-100 text-green-800" },
  NF: { label: "NF", color: "bg-blue-100 text-blue-800" },
  DF: { label: "DF", color: "bg-purple-100 text-purple-800" },
  Vegan: { label: "Vegan", color: "bg-emerald-100 text-emerald-800" },
  Vegetarian: { label: "Vegetarian", color: "bg-green-100 text-green-800" },
  Popular: { label: "Popular", color: "bg-amber-100 text-amber-800" },
  "Chef's Special": { label: "Chef's Special", color: "bg-red-100 text-red-800" },
  "Non-Vegetarian": { label: "Non-Veg", color: "bg-orange-100 text-orange-700" },
};

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

function isDinnerCategory(name: string): boolean {
  return name === "Dinner";
}

function isSpicyCategory(name: string): boolean {
  return [
    "Dinner",
    "Indo Chinese",
    "Vegetarian",
    "Rice Specialties",
    "Tandoori Specials",
    "Cafe Specials",
  ].includes(name);
}

export default function Menu() {
  const menuData = getMenuData();
  const categories = menuData.categories;

  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [selectedProtein, setSelectedProtein] = useState<string>("");
  const [selectedSpice, setSelectedSpice] = useState<string>("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [quantity, setQuantity] = useState<number>(1);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);

  const filteredCategories = useMemo(() => {
    if (selectedCategory === "all") return categories;
    return categories.filter((cat: { id: string }) => cat.id === selectedCategory);
  }, [categories, selectedCategory]);

  const cartTotal = cart.reduce((sum, item) => sum + item.totalPrice * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

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

  function handleAddToCart(item: MenuItem, categoryName: string) {
    const isDin = isDinnerCategory(categoryName);
    const isSpicy = isSpicyCategory(categoryName);

    if (isDin && !selectedProtein) return;
    if (isSpicy && !selectedSpice) return;

    const proteinObj = isDin ? PROTEIN_OPTIONS.find((p) => p.name === selectedProtein) : null;
    const surcharge = proteinObj ? proteinObj.surcharge : 0;

    const cartItem: CartItem = {
      id: `${item.id}-${selectedProtein || "none"}-${selectedSpice || "none"}-${Date.now()}`,
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
        .map((item) => (item.id === cartItemId ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item))
        .filter((item) => item.quantity > 0)
    );
  }

  return (
    <section id="menu" className="py-20 bg-[#FBF8F1]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-[#5C1A1B] mb-4">Our Menu</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Authentic Indian cuisine made with fresh ingredients and traditional recipes
          </p>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              selectedCategory === "all"
                ? "bg-[#5C1A1B] text-white shadow-md"
                : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
            }`}
          >
            All
          </button>
          {categories.map((cat: { id: string; name: string }) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedCategory === cat.id
                  ? "bg-[#5C1A1B] text-white shadow-md"
                  : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Menu Grid */}
        <div className="space-y-12">
          {filteredCategories.map((cat: { id: string; name: string; description?: string; items: MenuItem[] }) => {
            const catName = String(cat.name || "").trim();
            const isDin = isDinnerCategory(catName);
            const isSpicy = isSpicyCategory(catName);

            return (
              <div key={cat.id}>
                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-[#5C1A1B] mb-1">{cat.name}</h3>
                  {cat.description && <p className="text-gray-500 text-sm">{cat.description}</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {cat.items.map((item: MenuItem) => {
                    const isOpen = expandedItemId === item.id;
                    const proteinObj = isDin ? PROTEIN_OPTIONS.find((p) => p.name === selectedProtein) : null;
                    const surcharge = proteinObj ? proteinObj.surcharge : 0;
                    const lineTotal = (item.price + surcharge) * quantity;
                    const canAdd = isDin
                      ? selectedProtein !== "" && selectedSpice !== ""
                      : isSpicy
                        ? selectedSpice !== ""
                        : true;

                    return (
                      <div
                        key={item.id}
                        className={`bg-white rounded-xl border shadow-sm transition-shadow ${
                          isOpen ? "border-[#5C1A1B]/30 shadow-md ring-1 ring-[#5C1A1B]/10" : "border-gray-100 hover:shadow-md"
                        }`}
                      >
                        {/* Item Header */}
                        <button
                          type="button"
                          onClick={() => handleToggleExpand(item.id)}
                          className="w-full text-left p-5 flex justify-between items-start gap-3"
                        >
                          <div className="flex-1 min-w-0">
                            <h4 className="text-lg font-semibold text-gray-900">{item.name}</h4>
                            {item.description && (
                              <p className="text-sm text-gray-500 mt-1 leading-relaxed">{item.description}</p>
                            )}
                            {item.tags && item.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {item.tags.map((tag) => {
                                  const config = tagConfig[tag];
                                  return config ? (
                                    <span key={tag} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
                                      {config.icon}
                                      {config.label}
                                    </span>
                                  ) : null;
                                })}
                              </div>
                            )}
                          </div>
                          <div className="text-right shrink-0 flex flex-col items-end gap-1">
                            <span className="text-lg font-bold text-[#C4973B]">${item.price.toFixed(2)}</span>
                            <span className="text-xs text-gray-400 flex items-center gap-0.5">
                              {isOpen ? (
                                <>Close <ChevronUp className="w-3 h-3" /></>
                              ) : (
                                <>Options <ChevronDown className="w-3 h-3" /></>
                              )}
                            </span>
                          </div>
                        </button>

                        {/* ====== EXPANDED ====== */}
                        {isOpen && (
                          <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4">

                            {/* CHOOSE STYLE — Dinner only (matched by name) */}
                            {isDin && (
                              <div>
                                <label className="block text-sm font-medium text-gray-800 mb-2">
                                  Choose Style <span className="text-red-500 font-normal">Must Choose 1.</span>
                                </label>
                                <div className="flex flex-wrap gap-2">
                                  {PROTEIN_OPTIONS.map((protein) => (
                                    <button
                                      key={protein.name}
                                      type="button"
                                      onClick={() => setSelectedProtein(protein.name)}
                                      className={`px-4 py-2.5 rounded-lg text-sm font-medium border transition-all flex items-center gap-1.5 ${
                                        selectedProtein === protein.name
                                          ? "bg-[#5C1A1B] text-white border-[#5C1A1B] shadow-sm"
                                          : "bg-white text-gray-700 border-gray-200 hover:border-[#5C1A1B] hover:text-[#5C1A1B]"
                                      }`}
                                    >
                                      {protein.name}
                                      {protein.surcharge > 0 && (
                                        <span className="text-xs opacity-75">+${protein.surcharge.toFixed(2)}</span>
                                      )}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* SPICY LEVEL — 6 categories (matched by name) */}
                            {isSpicy && (
                              <div>
                                <label className="block text-sm font-medium text-gray-800 mb-2">
                                  Spicy Level <span className="text-red-500 font-normal">Must Choose 1.</span>
                                </label>
                                <div className="flex gap-2">
                                  {SPICE_LEVELS.map((level) => (
                                    <button
                                      key={level}
                                      type="button"
                                      onClick={() => setSelectedSpice(level)}
                                      className={`px-5 py-2.5 rounded-lg text-sm font-medium border transition-all ${
                                        selectedSpice === level
                                          ? "bg-[#5C1A1B] text-white border-[#5C1A1B] shadow-sm"
                                          : "bg-white text-gray-700 border-gray-200 hover:border-[#5C1A1B] hover:text-[#5C1A1B]"
                                      }`}
                                    >
                                      {level}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* SPECIAL INSTRUCTIONS — all */}
                            <div>
                              <label className="block text-sm font-medium text-gray-800 mb-1">Special instructions</label>
                              <textarea
                                value={specialInstructions}
                                onChange={(e) => setSpecialInstructions(e.target.value)}
                                placeholder="Dressing on the side? No pickles? Let the restaurant know here."
                                rows={2}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#5C1A1B]/30 focus:border-[#5C1A1B] resize-none"
                              />
                            </div>

                            {/* QUANTITY — all */}
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium text-gray-800">Quantity</span>
                              <div className="flex items-center gap-2">
                                <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 hover:bg-gray-100 transition-colors">
                                  <Minus className="w-4 h-4" />
                                </button>
                                <span className="w-8 text-center text-sm font-semibold text-gray-900">{quantity}</span>
                                <button type="button" onClick={() => setQuantity((q) => q + 1)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 hover:bg-gray-100 transition-colors">
                                  <Plus className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {/* ADD TO CART */}
                            <div className="flex items-center justify-between pt-2">
                              <div className="text-sm font-semibold text-gray-700">
                                ${lineTotal.toFixed(2)}
                                {surcharge > 0 && (
                                  <span className="text-xs font-normal text-gray-400 ml-1">
                                    (${item.price.toFixed(2)} + ${surcharge.toFixed(2)} x {quantity})
                                  </span>
                                )}
                                {surcharge === 0 && quantity > 1 && (
                                  <span className="text-xs font-normal text-gray-400 ml-1">
                                    (${item.price.toFixed(2)} x {quantity})
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleAddToCart(item, cat.name)}
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
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Floating Cart Button */}
        {cartCount > 0 && (
          <>
            <button
              type="button"
              onClick={() => setShowCart(!showCart)}
              className="fixed bottom-6 right-6 z-40 flex items-center gap-3 bg-[#5C1A1B] text-white px-5 py-3.5 rounded-full shadow-xl hover:bg-[#7A2526] transition-all"
            >
              <ShoppingCart className="w-5 h-5" />
              <span className="font-medium">{cartCount} item{cartCount !== 1 ? "s" : ""}</span>
              <span className="bg-[#C4973B] text-white text-xs font-bold px-2 py-0.5 rounded-full">
                ${cartTotal.toFixed(2)}
              </span>
            </button>

            {showCart && (
              <div className="fixed inset-0 z-50 flex justify-end">
                <div className="absolute inset-0 bg-black/40" onClick={() => setShowCart(false)} />
                <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col">
                  <div className="flex items-center justify-between px-6 py-4 border-b">
                    <h3 className="text-lg font-bold text-[#5C1A1B]">Your Order</h3>
                    <button type="button" onClick={() => setShowCart(false)} className="p-1 hover:bg-gray-100 rounded-full">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                    {cart.length === 0 ? (
                      <p className="text-center text-gray-400 py-10">Your cart is empty</p>
                    ) : (
                      cart.map((ci) => (
                        <div key={ci.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">{ci.name}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {ci.spiceLevel && <span>{ci.spiceLevel}</span>}
                              {ci.protein && <span>{ci.spiceLevel ? " · " : ""}{ci.protein}</span>}
                              <span>{ci.spiceLevel || ci.protein ? " · " : ""}Qty: {ci.quantity}</span>
                            </p>
                            {ci.specialInstructions && (
                              <p className="text-xs text-gray-400 mt-0.5 italic">{ci.specialInstructions}</p>
                            )}
                            {ci.surcharge && ci.surcharge > 0 && (
                              <p className="text-xs text-gray-400 mt-0.5">
                                ${ci.basePrice.toFixed(2)} + ${ci.surcharge.toFixed(2)} surcharge each
                              </p>
                            )}
                            <p className="text-sm font-bold text-[#C4973B] mt-1">
                              ${(ci.totalPrice * ci.quantity).toFixed(2)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => handleUpdateQuantity(ci.id, -1)} className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-300 hover:bg-gray-100">
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-sm font-medium w-6 text-center">{ci.quantity}</span>
                            <button type="button" onClick={() => handleUpdateQuantity(ci.id, 1)} className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-300 hover:bg-gray-100">
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="border-t px-6 py-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 font-medium">Subtotal</span>
                      <span className="text-lg font-bold text-gray-900">${cartTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm text-gray-400">
                      <span>Tax (7%)</span>
                      <span>${(cartTotal * 0.07).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="font-bold text-gray-900">Total</span>
                      <span className="text-xl font-bold text-[#5C1A1B]">${(cartTotal * 1.07).toFixed(2)}</span>
                    </div>
                    <button type="button" className="w-full bg-[#C4973B] text-white font-bold py-3 rounded-lg hover:bg-[#d4a84b] transition-colors" onClick={() => alert("Checkout coming soon! Stripe integration pending.")}>
                      Proceed to Checkout
                    </button>
                    <p className="text-xs text-center text-gray-400">Pickup only · Tax included at 7%</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}