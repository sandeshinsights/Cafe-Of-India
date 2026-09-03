"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { getMenuData, getMenuItemSlug } from "@/lib/data";
import type { MenuItem, MenuCategory } from "@/lib/types";
import Image from "next/image";
import { ShoppingCart, ChevronRight, Clock, Link2 } from "lucide-react";
import { useCart } from "@/context/CartContext";
// Meta Pixel — browser-only funnel event. ViewContent has no server counterpart.
import { trackMeta } from "@/lib/meta-pixel";
// The pick-options-and-add form, shared with the standalone /menu/<slug> page.
import MenuItemOrderForm from "@/components/MenuItemOrderForm";

/* ─── component ─── */

export default function Menu() {
  const menuData = getMenuData();
  const categories = menuData.categories;
  const { itemCount, openCart } = useCart();

  /* state */
  const [selectedCategory, setSelectedCategory] = useState(
    categories[0]?.id || ""
  );
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  /* shareable-link copy feedback, keyed by menu item id */
  const [copiedId, setCopiedId] = useState<string | null>(null);

  /* ─── deep link ─── */
  // Open a specific dish on arrival when the URL carries ?item=menu-115 (with
  // or without #menu): switch to its category, expand it, then let the effect
  // below scroll to it once it has rendered. The per-dish pages now add to the
  // cart themselves, but external ?item= links (and any shared before that
  // change) still land here. Runs once; an unknown id is ignored.
  const pendingScrollId = useRef<string | null>(null);
  const deepLinkHandled = useRef(false);
  useEffect(() => {
    if (deepLinkHandled.current) return;
    deepLinkHandled.current = true;

    const wanted = new URLSearchParams(window.location.search).get("item");
    if (!wanted) return;

    const cat = categories.find((c) =>
      c.items?.some((i) => i.id === wanted)
    );
    if (!cat) return;
    const target = cat.items.find((i) => i.id === wanted);

    pendingScrollId.current = wanted;
    // Deferred a frame so the state updates land as their own render pass
    // rather than cascading straight off this effect.
    const raf = requestAnimationFrame(() => {
      setSelectedCategory(cat.id);
      setExpandedItemId(wanted);
    });

    if (target) {
      trackMeta("ViewContent", {
        content_ids: [target.id],
        content_name: target.name,
        content_type: "product",
        content_category: cat.name,
        value: target.price,
        currency: "USD",
      });
    }

    return () => cancelAnimationFrame(raf);
  }, [categories]);

  // Scroll to the deep-linked dish once its category has rendered and the node
  // exists — deterministic, unlike a fixed timeout that can fire too early on a
  // slow render.
  useEffect(() => {
    const id = pendingScrollId.current;
    if (!id || expandedItemId !== id) return;
    const el = document.getElementById(`menu-item-${id}`);
    if (!el) return;
    pendingScrollId.current = null;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [expandedItemId, selectedCategory]);

  function handleCopyLink(id: string) {
    const url = `${window.location.origin}/menu/${getMenuItemSlug(id) ?? id}`;
    navigator.clipboard
      ?.writeText(url)
      .then(() => {
        setCopiedId(id);
        setTimeout(
          () => setCopiedId((current) => (current === id ? null : current)),
          2000
        );
      })
      .catch(() => {
        /* clipboard blocked (insecure context, denied permission) — no-op */
      });
  }

  /* derived */
  const activeCategory = useMemo(
    () => categories.find((cat) => cat.id === selectedCategory),
    [categories, selectedCategory]
  );

  /* ─── helpers ─── */

  function handleToggleExpand(item: MenuItem, categoryName?: string) {
    if (expandedItemId === item.id) {
      setExpandedItemId(null);
      return;
    }

    setExpandedItemId(item.id);

    // Opening the detail panel is the closest thing this menu has to viewing a
    // product page — it is where the customer reads the description and picks
    // options, so it is what Meta should see as ViewContent.
    trackMeta("ViewContent", {
      content_ids: [item.id],
      content_name: item.name,
      content_type: "product",
      content_category: categoryName,
      value: item.price,
      currency: "USD",
    });
  }

  /* ─── render ─── */

  return (
    <section id="menu" className="py-16 px-4 bg-cream">
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

        {/* menu banner */}
        {menuData.banner && (
          <div className="relative w-full aspect-[21/9] rounded-2xl overflow-hidden mb-8">
            <Image
              src={menuData.banner}
              alt="Our Menu"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 1152px"
              loading="eager"
            />
          </div>
        )}

        {/* category tabs */}
        <div className="flex flex-wrap gap-2 mb-8 justify-center">
          {categories.map((cat: MenuCategory) => (
            <button
              key={cat.id}
              onClick={() => {
                setSelectedCategory(cat.id);
                setExpandedItemId(null);
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
          {activeCategory?.items?.map((item: MenuItem) => {
            const isExpanded = expandedItemId === item.id;

            return (
              <div
                key={item.id}
                id={`menu-item-${item.id}`}
                className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden scroll-mt-24"
              >
                {/* header row */}
                <button
                  onClick={() => handleToggleExpand(item, activeCategory.name)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
                >
                  {item.image && (
                    <div className="relative w-16 h-16 sm:w-20 sm:h-20 shrink-0 mr-3 rounded-lg overflow-hidden bg-gray-100">
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                    </div>
                  )}
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

                    <MenuItemOrderForm
                      item={item}
                      categoryName={activeCategory.name}
                      onAdded={() => setExpandedItemId(null)}
                    />

                    {/* Shareable link to this dish */}
                    <button
                      type="button"
                      onClick={() => handleCopyLink(item.id)}
                      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#5C1A1B] transition-colors"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      {copiedId === item.id
                        ? "Link copied"
                        : "Copy shareable link"}
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