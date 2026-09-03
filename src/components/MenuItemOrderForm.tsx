"use client";

import { useState } from "react";
import { ShoppingCart, Plus, Minus } from "lucide-react";
import { useCart } from "@/context/CartContext";
// Shared with the checkout API so the displayed surcharge and the charged
// surcharge can't drift apart.
import { PROTEIN_OPTIONS } from "@/lib/pricing";
// Meta Pixel — browser-only funnel event. AddToCart has no server counterpart.
import { trackMeta } from "@/lib/meta-pixel";
import type { MenuItem } from "@/lib/types";

/* ─── which categories need which choice ─── */

export function isDinnerCategory(name: string): boolean {
  return name.toLowerCase() === "dinner";
}

export function isSpicyCategory(name: string): boolean {
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

type Props = {
  item: MenuItem;
  categoryName: string;
  /**
   * Runs after a line is added to the cart. Given → it is called (the menu panel
   * uses it to collapse itself). Not given → the cart drawer opens instead, which
   * is what the standalone dish page wants.
   */
  onAdded?: () => void;
};

/**
 * The "pick your options and add to cart" form for one menu item. Lifted out of
 * Menu.tsx so the shareable per-dish page (`/menu/<slug>`) can add to the cart
 * directly instead of bouncing the customer back to the homepage menu.
 *
 * The cart-line id keeps the `${baseId}-${protein}-${spice}-${timestamp}` shape
 * that `/api/checkout` relies on to recover the server-side price — do not change
 * it here without changing `getMenuItemPrice` in the checkout route.
 */
export default function MenuItemOrderForm({
  item,
  categoryName,
  onAdded,
}: Props) {
  const { addItem, openCart } = useCart();

  const [selectedProtein, setSelectedProtein] = useState("");
  const [selectedSpice, setSelectedSpice] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [quantity, setQuantity] = useState(1);

  const needsStyle = isDinnerCategory(categoryName);
  const needsSpice = isSpicyCategory(categoryName);
  const canAdd =
    (!needsStyle || selectedProtein) && (!needsSpice || selectedSpice);

  const missing = !selectedProtein && needsStyle
    ? "Choose a style to add this to your order"
    : !selectedSpice && needsSpice
      ? "Choose a spice level to add this to your order"
      : "";

  function handleAdd() {
    if (!canAdd) return;

    const proteinObj = needsStyle
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
      quantity,
    });

    trackMeta("AddToCart", {
      content_ids: [item.id],
      content_name: item.name,
      content_type: "product",
      content_category: categoryName,
      contents: [
        { id: item.id, quantity, item_price: item.price + surcharge },
      ],
      num_items: quantity,
      value: (item.price + surcharge) * quantity,
      currency: "USD",
    });

    setSelectedProtein("");
    setSelectedSpice("");
    setSpecialInstructions("");
    setQuantity(1);

    if (onAdded) onAdded();
    else openCart();
  }

  const unitPrice =
    item.price +
    (needsStyle
      ? PROTEIN_OPTIONS.find((p) => p.name === selectedProtein)?.surcharge || 0
      : 0);

  return (
    <div className="space-y-4">
      {/* Choose Style (Dinner only) */}
      {needsStyle && (
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

      {/* Spicy Level */}
      {needsSpice && (
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
          onChange={(e) => setSpecialInstructions(e.target.value)}
          placeholder="Any allergies or preferences?"
          rows={2}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#C4973B]/50 focus:border-[#C4973B]"
        />
      </div>

      {/* Quantity */}
      <div>
        <p className="text-sm font-semibold text-[#5C1A1B] mb-2">Quantity</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 hover:bg-gray-100"
          >
            <Minus className="w-3 h-3" />
          </button>
          <span className="text-sm font-medium w-8 text-center">{quantity}</span>
          <button
            type="button"
            onClick={() => setQuantity((q) => q + 1)}
            className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 hover:bg-gray-100"
          >
            <Plus className="w-3 h-3" />
          </button>
          {(selectedProtein || quantity > 1) && (
            <span className="text-sm text-[#C4973B] font-medium ml-2">
              Total: ${(unitPrice * quantity).toFixed(2)}
            </span>
          )}
        </div>
      </div>

      {/* Add to cart */}
      <div className="space-y-1.5">
        <button
          type="button"
          onClick={handleAdd}
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
        {!canAdd && missing && (
          <p className="text-xs text-gray-500">{missing}</p>
        )}
      </div>
    </div>
  );
}
