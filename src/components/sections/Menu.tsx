"use client";

import { useState, useMemo } from "react";
import { getMenuData } from "@/lib/data";
import {
  ShoppingCart,
  Plus,
  Minus,
  ChevronRight,
  Clock,
} from "lucide-react";
import { useCart } from "@/context/CartContext";

/* ─── constants ─── */

const PROTEIN_OPTIONS = [
  { name: "Chicken", surcharge: 0.0 },
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
  const { addItem, itemCount, openCart } = useCart();

  /* state */
  const [selectedCategory, setSelectedCategory] = useState(
    categories[0]?.id || ""
  );
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  /* item-level form state */
  const [selectedProtein, setSelectedProtein] = useState("");
  const [selectedSpice, setSelectedSpice] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [quantity, setQuantity] = useState(1);

  /* derived */
  const activeCategory = useMemo(
    () => categories.find((cat: { id: string }) => cat.id === selectedCategory),
    [categories, selectedCategory]
  );

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

    addItem({
      id: `${item.id}-${selectedProtein || "none"}-${selectedSpice || "none"}-${Date.now()}`,
      name: selectedProtein ? `${selectedProtein} ${item.name}` : item.name,
      price: item.price + surcharge,
      protein: selectedProtein || undefined,
      surcharge: surcharge || undefined,
      spiceLevel: selectedSpice || undefined,
      specialInstructions: specialInstructions.trim() || undefined,
      quantity: quantity,
    });

    setExpandedItemId(null);
    resetForm();
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

        {/* category title */}
        <h3 className="text-xl font-semibold text-[#5C1A1B] mb-6">
          {activeCategory?.name}
        </h3>

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
                    {item.description && (
                      <p className="text-sm text-gray-600">
                        {item.description}
                      </p>
                    )}

                    {/* Choose Style (Dinner only) */}
                    {isDin && (
                      <div>
                        <p className="text-sm font-semibold text-[#5C1A1B] mb-2">
                          Choose Style <span className="text-red-500">*</span>
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

                    {/* Spicy Level (6 categories) */}
                    {isSpicy && (
                      <div>
                        <p className="text-sm font-semibold text-[#5C1A1B] mb-2">
                          Spicy Level <span className="text-red-500">*</span>
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

                    {/* Special Instructions */}
                    <div>
                      <p className="text-sm font-semibold text-[#5C1A1B] mb-2">
                        Special Instructions
                      </p>
                      <textarea
                        value={specialInstructions}
                        onChange={(e) =>
                          setSpecialInstructions(e.target.value)
                        }
                        placeholder="Any allergies or preferences?"
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#C4973B]/50 focus:border-[#C4973B]"
                      />
                    </div>

                    {/* Quantity */}
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
                          <span className="text-sm text-[#C4973B] font-medium ml-2">
                            Total: $                             {(
                              (item.price +
                                (PROTEIN_OPTIONS.find(
                                  (p) => p.name === selectedProtein
                                )?.surcharge || 0)) *
                              quantity
                            ).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Add to cart */}
                    <button
                      type="button"
                      onClick={() =>
                        handleAddToCart(item, activeCategory.name)
                      }
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

      {/* Floating Cart Button */}
      <button
        onClick={openCart}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-[#5C1A1B] text-white px-5 py-3 rounded-full shadow-lg hover:bg-[#7A2526] transition-all hover:scale-105"
      >
        <ShoppingCart className="w-5 h-5" />
        Cart
        {itemCount > 0 && (
          <span className="bg-[#C4973B] text-white text-xs w-6 h-6 rounded-full flex items-center justify-center font-bold">
            {itemCount > 99 ? "99+" : itemCount}
          </span>
        )}
      </button>
    </section>
  );
}