"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { getMenuData, getMenuItem, getMenuItemSlug } from "@/lib/data";
import type { MenuItem, MenuCategory } from "@/lib/types";
import Image from "next/image";
import { ShoppingCart, ChevronLeft, ChevronRight, Clock, Link2, Search, X, Gift } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { ORDERING_CONFIG, formatMinutesTo12h } from "@/lib/ordering-hours";
import { OFFER_TIERS } from "@/lib/free-item-offer";
// Meta Pixel — browser-only funnel event. ViewContent has no server counterpart.
import { trackMeta } from "@/lib/meta-pixel";
// The pick-options-and-add form, shared with the standalone /menu/<slug> page.
import MenuItemOrderForm from "@/components/MenuItemOrderForm";

/* ─── display-only copy derived from the real config ─── */

// "Online ordering until 8:45 PM" — read from the same ORDERING_CONFIG checkout
// enforces. This line used to be hand-written as "Pickup only · Last order at
// 7:00 PM", which was wrong twice: delivery is live, and the window runs later.
const [endH, endM] = ORDERING_CONFIG.orderingEnds.split(":").map(Number);
const ORDERING_ENDS_LABEL = formatMinutesTo12h(endH * 60 + endM);

// The spend-threshold offer, lowest tier first, with dish names looked up from
// menu.json. Advertising only: what is actually comped is decided by
// free-item-offer.ts at checkout, which this reads its tiers from.
const OFFER_LINES = [...OFFER_TIERS]
  .sort((a, b) => a.threshold - b.threshold)
  .map((tier) => ({
    threshold: tier.threshold,
    names: tier.itemIds
      .map((id) => getMenuItem(id)?.item.name)
      .filter((n): n is string => Boolean(n)),
  }))
  .filter((line) => line.names.length > 0);

/* ─── component ─── */

export default function Menu() {
  const menuData = getMenuData();
  const categories = menuData.categories;
  const { itemCount, subtotal, openCart } = useCart();

  /* category strip: keep the active tab in view, and bring the list back up
     to the top when switching categories from far down the page */
  const tabStripRef = useRef<HTMLDivElement>(null);
  const listTopRef = useRef<HTMLDivElement>(null);

  /* The floating cart stays out of the way while the hero fills the screen:
     on phones it spans the width and would sit on top of the hero's own
     buttons, and the header already shows the cart count up there.
     null until the observer first reports, and the bar shows only on an
     explicit false, so it never flashes over the hero on load. That relies on
     the hero existing, which page.tsx guarantees (it is not switchable). */
  const [heroInView, setHeroInView] = useState<boolean | null>(null);
  useEffect(() => {
    const hero = document.getElementById("hero");
    if (!hero) return;
    const observer = new IntersectionObserver(
      ([entry]) => setHeroInView(entry.intersectionRatio > 0.5),
      { threshold: [0, 0.5, 1] }
    );
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  /* state */
  const [selectedCategory, setSelectedCategory] = useState(
    categories[0]?.id || ""
  );
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  /* menu search — filters across every category, not just the selected one */
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  function handleSelectCategory(id: string) {
    setSelectedCategory(id);
    setExpandedItemId(null);
    // The strip is sticky, so it can be tapped from far down a long category.
    // Bring the new list's top up under it rather than leaving the customer
    // mid-page in a list they have not seen.
    const top = listTopRef.current;
    const stripBottom = tabStripRef.current?.getBoundingClientRect().bottom ?? 0;
    if (top && top.getBoundingClientRect().top < stripBottom) {
      top.scrollIntoView({ block: "start" });
    }
  }

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

  const trimmedQuery = searchQuery.trim();
  const isSearching = trimmedQuery !== "";

  // The category strip is one horizontally scrolling row; keep the selected
  // tab centred in it — after a deep link switches it, and when the strip
  // remounts after a search is cleared (it comes back scrolled to the start).
  // Scrolls only the strip, never the page.
  useEffect(() => {
    const strip = tabStripRef.current;
    const tab = strip?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!strip || !tab || strip.scrollWidth <= strip.clientWidth) return;
    strip.scrollTo({
      left: tab.offsetLeft - strip.clientWidth / 2 + tab.clientWidth / 2,
      behavior: "smooth",
    });
  }, [selectedCategory, isSearching]);

  // Where the category strip is scrolled to. Drives the arrow buttons, the
  // edge fades and the progress bar under the row — together they tell
  // visitors the row scrolls, which a bare overflow row with a hidden
  // scrollbar never did. Re-subscribes when the strip remounts after a search
  // is cleared. thumbSize/thumbOffset are percentages of the track.
  const [stripScroll, setStripScroll] = useState({
    overflow: false,
    left: false,
    right: false,
    thumbSize: 100,
    thumbOffset: 0,
  });
  useEffect(() => {
    const strip = tabStripRef.current;
    if (!strip) return;
    const update = () => {
      const { scrollLeft, scrollWidth, clientWidth } = strip;
      const max = scrollWidth - clientWidth;
      const next = {
        overflow: max > 2,
        // 2px of slack: fractional widths can leave scrollLeft a hair short of max.
        left: scrollLeft > 2,
        right: scrollLeft < max - 2,
        thumbSize: (clientWidth / scrollWidth) * 100,
        thumbOffset: (scrollLeft / scrollWidth) * 100,
      };
      setStripScroll((prev) =>
        prev.overflow === next.overflow &&
        prev.left === next.left &&
        prev.right === next.right &&
        Math.abs(prev.thumbSize - next.thumbSize) < 0.1 &&
        Math.abs(prev.thumbOffset - next.thumbOffset) < 0.1
          ? prev
          : next
      );
    };
    // ResizeObserver reports once on observe, which sets the initial state.
    const observer = new ResizeObserver(update);
    observer.observe(strip);
    strip.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      strip.removeEventListener("scroll", update);
    };
  }, [isSearching]);

  function scrollStrip(direction: -1 | 1) {
    const strip = tabStripRef.current;
    if (!strip) return;
    strip.scrollBy({ left: direction * strip.clientWidth * 0.7, behavior: "smooth" });
  }

  // Click or drag on the progress bar scrolls the strip, centring the view on
  // the pointer — on a desktop mouse the bar is what people reach for.
  function scrubStrip(e: React.PointerEvent<HTMLDivElement>) {
    const strip = tabStripRef.current;
    if (!strip) return;
    const track = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - track.left) / track.width));
    strip.scrollLeft = ratio * strip.scrollWidth - strip.clientWidth / 2;
  }

  // The rows to render, each tagged with the category it lives in. That name is
  // not just a label: MenuItemOrderForm uses it to decide whether a protein
  // (Dinner) and a spice level are required, so a search result must carry its
  // own category — never the one selected in the nav — or a Dinner dish found
  // by search could be added to the cart with no protein.
  const visibleItems = useMemo<{ item: MenuItem; categoryName: string }[]>(() => {
    if (!isSearching) {
      if (!activeCategory) return [];
      return (activeCategory.items ?? []).map((item) => ({
        item,
        categoryName: activeCategory.name,
      }));
    }
    const q = trimmedQuery.toLowerCase();
    return categories.flatMap((cat) =>
      (cat.items ?? [])
        .filter(
          (item) =>
            item.name.toLowerCase().includes(q) ||
            (item.description ?? "").toLowerCase().includes(q)
        )
        .map((item) => ({ item, categoryName: cat.name }))
    );
  }, [isSearching, trimmedQuery, activeCategory, categories]);

  // Collapse any open dish whenever the query changes. Done here rather than in
  // an effect so it lands in the same render as the new results. The search
  // never touches selectedCategory, so clearing it restores the prior category.
  function handleSearchChange(value: string) {
    setSearchQuery(value);
    setExpandedItemId(null);
  }

  function handleClearSearch() {
    handleSearchChange("");
    searchInputRef.current?.focus();
  }

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
        {/* Same eyebrow + gold rule treatment as the other section headings. */}
        <div className="text-center mb-10">
          <p className="text-secondary text-sm font-medium tracking-[0.2em] uppercase mb-3">
            Order Online
          </p>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-primary mb-4">
            Our Menu
          </h2>
          <div className="w-16 h-px bg-secondary/60 mx-auto mb-4" />
          <p className="text-text-light text-lg">
            Authentic Indian &amp; Nepali flavors, made fresh daily &middot; pickup or delivery
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

        {/* spend-threshold offer — until now only visible inside the cart */}
        {OFFER_LINES.length > 0 && (
          <div className="max-w-2xl mx-auto mb-6 flex items-start gap-3 rounded-xl border border-secondary/30 bg-secondary/10 px-4 py-3 text-sm text-primary">
            <Gift className="w-5 h-5 shrink-0 text-secondary mt-0.5" />
            <div>
              {OFFER_LINES.map((line) => (
                <p key={line.threshold} className="font-semibold">
                  Spend ${line.threshold}, get a free {line.names.join(" + ")}
                </p>
              ))}
              <p className="text-text-light mt-0.5">
                Add it to your cart and it comes off at checkout.
              </p>
            </div>
          </div>
        )}

        {/* search */}
        <div className="relative max-w-md mx-auto mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="search"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search dishes"
            aria-label="Search the menu"
            className="w-full rounded-full bg-white border border-primary/20 pl-11 pr-11 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/30 [&::-webkit-search-cancel-button]:appearance-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={handleClearSearch}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-primary hover:bg-gray-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* category tabs — hidden while searching, since results span them all */}
        {/* Sticky under the header, so switching category never means scrolling
            back up. One horizontally scrolling row at every width, inside a
            card with a progress bar under it: fifteen wrapped pills used to
            fill most of the first screen before a single dish. */}
        {!isSearching && (
          <div className="sticky top-20 z-20 -mx-4 px-4 py-3 mb-6 bg-cream/95 backdrop-blur-sm">
            <div className="rounded-2xl border border-primary/10 bg-white shadow-sm overflow-hidden">
              <div className="relative">
                {/* scroller — `relative` so each tab's offsetLeft is measured
                    against it (the centring effect above relies on that) */}
                <div
                  ref={tabStripRef}
                  className="relative overflow-x-auto no-scrollbar px-3 pt-3 pb-2"
                >
                  {/* w-max + mx-auto: centred when the row fits, scrollable when not */}
                  <div className="flex gap-1 w-max mx-auto">
                    {categories.map((cat: MenuCategory) => (
                      <button
                        key={cat.id}
                        onClick={() => handleSelectCategory(cat.id)}
                        aria-pressed={selectedCategory === cat.id}
                        className={`shrink-0 whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                          selectedCategory === cat.id
                            ? "bg-primary text-white shadow-sm"
                            : "text-gray-600 hover:text-primary hover:bg-primary/5"
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>

                {stripScroll.left && (
                  <>
                    <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-linear-to-r from-white to-transparent" />
                    <button
                      type="button"
                      onClick={() => scrollStrip(-1)}
                      aria-label="Scroll categories left"
                      className="absolute left-2 top-[calc(50%+2px)] -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full bg-white text-primary border border-primary/20 shadow-md hover:bg-primary hover:text-white transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                  </>
                )}
                {stripScroll.right && (
                  <>
                    <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-linear-to-l from-white to-transparent" />
                    <button
                      type="button"
                      onClick={() => scrollStrip(1)}
                      aria-label="Scroll categories right"
                      className="absolute right-2 top-[calc(50%+2px)] -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full bg-white text-primary border border-primary/20 shadow-md hover:bg-primary hover:text-white transition-colors"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}
              </div>

              {/* progress bar: thumb width = share of the row in view, position =
                  how far along it is. Decorative for screen readers (the tabs
                  and arrows carry the semantics); taller invisible hit area so
                  it is easy to grab. */}
              {stripScroll.overflow && (
                <div
                  aria-hidden="true"
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    scrubStrip(e);
                  }}
                  onPointerMove={(e) => {
                    if (e.currentTarget.hasPointerCapture(e.pointerId)) scrubStrip(e);
                  }}
                  className="mx-4 pt-1 pb-3 cursor-pointer touch-none"
                >
                  <div className="relative h-1.5 rounded-full bg-primary/10">
                    <div
                      className="absolute inset-y-0 rounded-full bg-primary/70"
                      style={{
                        width: `${stripScroll.thumbSize}%`,
                        left: `${stripScroll.thumbOffset}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* scroll target for handleSelectCategory; the margin clears the fixed
            header plus the sticky category strip (one row on phones, up to two
            wrapped rows on desktop) */}
        <div ref={listTopRef} className="scroll-mt-48" />

        {/* category title, or search results + count */}
        {isSearching ? (
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-primary">
              Search results
            </h3>
            <p className="text-sm text-gray-500 mt-1" aria-live="polite">
              {visibleItems.length === 0
                ? `No dishes match “${trimmedQuery}”.`
                : visibleItems.length === 1
                  ? `1 dish matches “${trimmedQuery}”.`
                  : `${visibleItems.length} dishes match “${trimmedQuery}”.`}
            </p>
          </div>
        ) : (
          <h3 className="text-xl font-semibold text-primary mb-6">
            {activeCategory?.name}
          </h3>
        )}

        {/* items list */}
        <div className="space-y-3">
          {visibleItems.map(({ item, categoryName }) => {
            const isExpanded = expandedItemId === item.id;

            return (
              <div
                key={item.id}
                id={`menu-item-${item.id}`}
                className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden scroll-mt-24"
              >
                {/* header row */}
                <button
                  onClick={() => handleToggleExpand(item, categoryName)}
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
                    {isSearching && (
                      <p className="text-xs uppercase tracking-wide text-secondary font-semibold">
                        {categoryName}
                      </p>
                    )}
                    <h4 className="font-semibold text-primary text-base truncate">
                      {item.name}
                    </h4>
                    {item.description && (
                      <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">
                        {item.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 ml-3 shrink-0">
                    <span className="font-bold text-secondary">
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
                      categoryName={categoryName}
                      onAdded={() => setExpandedItemId(null)}
                    />

                    {/* Shareable link to this dish */}
                    <button
                      type="button"
                      onClick={() => handleCopyLink(item.id)}
                      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-primary transition-colors"
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

        {/* ordering notice */}
        <div className="mt-8 text-center text-sm text-gray-500 flex items-center justify-center gap-2">
          <Clock className="w-4 h-4" />
          Pickup &amp; delivery &middot; 7% MA tax &middot; Online ordering until{" "}
          {ORDERING_ENDS_LABEL}
        </div>
      </div>

      {/* Floating cart. Shown only once something is in the cart — an empty
          "Cart" pill floating over the hero was noise, and the header keeps a
          cart button either way. Carries the running subtotal so it reads as
          the next step, and spans the width on phones where it is the thumb's
          natural target. The subtotal is pre-tax, and labelled so. */}
      {itemCount > 0 && heroInView === false && (
        <button
          onClick={openCart}
          className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:bottom-6 sm:right-6 z-40 flex items-center justify-between sm:justify-start gap-3 bg-primary text-white pl-5 pr-4 py-3 rounded-full shadow-lg shadow-black/20 hover:bg-primary-light transition-all sm:hover:scale-105"
        >
          <span className="flex items-center gap-2 font-semibold">
            <ShoppingCart className="w-5 h-5" />
            View cart
            <span className="bg-secondary text-white text-xs min-w-6 h-6 px-1.5 rounded-full flex items-center justify-center font-bold">
              {itemCount > 99 ? "99+" : itemCount}
            </span>
          </span>
          <span className="text-sm text-white/90">
            ${subtotal.toFixed(2)}
            <span className="text-white/60 text-xs"> + tax</span>
          </span>
        </button>
      )}
    </section>
  );
}