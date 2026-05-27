"use client";

import { useState } from "react";
import { Flame, Star, Leaf, Wheat } from "lucide-react";
import { getMenuData } from "@/lib/data";
import { cn, formatPrice, capitalize } from "@/lib/utils";

/**
 * Menu Section
 * 
 * WHAT IT DOES:
 * - Displays the full restaurant menu organized by category
 * - Category tabs across the top (horizontally scrollable on mobile)
 * - Menu items shown as clean cards with name, description, price
 * - Dietary tags (vegetarian, vegan, gluten-free) shown as colored badges
 * - Special badges (Best Seller, Chef's Favorite, etc.) highlighted
 * 
 * WHY "use client":
 * - Category tab switching needs useState
 * - Client component for interactive tab selection
 */

const tagConfig: Record<string, { label: string; color: string; icon?: React.ReactNode }> = {
  vegetarian: { label: "Vegetarian", color: "bg-green-100 text-green-800", icon: <Leaf className="w-3 h-3" /> },
  vegan: { label: "Vegan", color: "bg-emerald-100 text-emerald-800", icon: <Leaf className="w-3 h-3" /> },
  "gluten-free": { label: "GF", color: "bg-amber-100 text-amber-800", icon: <Wheat className="w-3 h-3" /> },
};

export default function Menu() {
  const { categories } = getMenuData();
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id || "");

  const activeItems = categories.find((c) => c.id === activeCategory);

  return (
    <section id="menu" className="py-20 bg-cream">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold text-primary mb-4">
            Our Menu
          </h2>
          <p className="text-text-light text-lg max-w-2xl mx-auto">
            Explore our authentic Indian dishes crafted with traditional recipes and the freshest ingredients.
          </p>
        </div>

        {/* Category Tabs */}
        <div className="mb-10">
          <div className="flex overflow-x-auto gap-2 pb-4 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap sm:justify-center">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={cn(
                  "flex-shrink-0 px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap",
                  activeCategory === category.id
                    ? "bg-primary text-white shadow-md"
                    : "bg-white text-text-main hover:bg-primary/10 border border-gray-200"
                )}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>

        {/* Category Description */}
        {activeItems && (
          <p className="text-text-light text-center mb-8 text-sm italic">
            {activeItems.description}
          </p>
        )}

        {/* Menu Items Grid */}
        {activeItems && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {activeItems.items.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-200 border border-gray-100"
              >
                <div className="flex justify-between items-start gap-4">
                  {/* Item Info */}
                  <div className="flex-1">
                    {/* Name + Badge */}
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <h3 className="font-heading text-lg font-bold text-text-main">
                        {item.name}
                      </h3>
                      {item.badge && (
                        <span className="inline-flex items-center gap-1 bg-secondary/15 text-secondary text-xs font-semibold px-2 py-0.5 rounded-full">
                          {item.badge === "Best Seller" && <Flame className="w-3 h-3" />}
                          {item.badge === "Chef's Favorite" && <Star className="w-3 h-3" />}
                          {item.badge === "House Special" && <Star className="w-3 h-3" />}
                          {item.badge}
                        </span>
                      )}
                    </div>

                    {/* Description */}
                    <p className="text-text-light text-sm leading-relaxed mb-3">
                      {item.description}
                    </p>

                    {/* Dietary Tags */}
                    {item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {item.tags.map((tag) => {
                          const config = tagConfig[tag];
                          if (!config) return null;
                          return (
                            <span
                              key={tag}
                              className={cn(
                                "inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
                                config.color
                              )}
                            >
                              {config.icon}
                              {config.label}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Price */}
                  <div className="flex-shrink-0 text-right">
                    <span className="font-heading text-xl font-bold text-primary">
                      {formatPrice(item.price)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}