import { Star, Flame, Award, ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getMenuData, getMenuItemSlug } from "@/lib/data";
import { formatPrice } from "@/lib/utils";
import type { ChefsSpecial, MenuCategory, MenuItem } from "@/lib/types";

interface SpecialDetail extends ChefsSpecial {
  price?: number;
  description?: string;
  photoUrl: string;
  /** /menu/<slug> page for the dish, where it can be added to the cart. */
  href: string | null;
}

/**
 * Keyed by menu id, and each photo must show THAT dish. These used to be
 * AI-generated shots of butter chicken, dal makhani and biryani sitting under
 * the names Goan Shrimp Curry, Lamb Roganjosh and Green Chili Chicken.
 * Current photos are Unsplash License stock (free for commercial use) until
 * real ones are taken: CHUTTERSNAP (-ps36yg89Lg), Lola Azizada (5dCl_1GBB7c),
 * Dr Muhammad Amer (hEMOwugpjJk).
 */
const specialPhotos: Record<string, string> = {
  "menu-70": "/images/specials/goan-shrimp-curry.jpg",
  "menu-69": "/images/specials/lamb-roganjosh.jpg",
  "menu-66": "/images/specials/green-chili-chicken.jpg",
};

export default function Specials() {
  const menuData = getMenuData();

  const specialDetails: SpecialDetail[] = menuData.chefsSpecials.map(
    (special: ChefsSpecial) => {
      const category: MenuCategory | undefined = menuData.categories.find(
        (cat: MenuCategory) =>
          cat.items.some((item: MenuItem) => item.id === special.id)
      );
      const menuItem: MenuItem | undefined = category?.items.find(
        (item: MenuItem) => item.id === special.id
      );
      const photoUrl: string = specialPhotos[special.id] || "";

      return {
        ...special,
        price: menuItem?.price,
        description: menuItem?.description,
        photoUrl,
        href: menuItem ? `/menu/${getMenuItemSlug(special.id) ?? special.id}` : null,
      } as SpecialDetail;
    }
  );

  return (
    <section id="specials" className="py-20 bg-primary text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-5 py-2 mb-6">
            <Star className="w-4 h-4 text-secondary" />
            <span className="text-sm font-medium tracking-wide uppercase">
              Handpicked by Our Chef
            </span>
          </div>
          <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold mb-4 text-white">
            Chef&apos;s Specials
          </h2>
          <p className="text-white/80 text-lg max-w-2xl mx-auto">
            Our head chef&apos;s personal recommendations — the dishes our guests
            love the most.
          </p>
        </div>

        {/* Specials Grid. Each card links to the dish's own page, where it can
            be added to the cart — these used to be look-but-don't-touch, so a
            customer sold on the butter chicken had to go and find it. */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {specialDetails.map((special: SpecialDetail, index: number) => {
            const card = (
              <>
                {/* Dish Photo, edge to edge */}
                <div className="relative w-full aspect-[4/3] bg-white/10 overflow-hidden">
                  {special.photoUrl ? (
                    <Image
                      src={special.photoUrl}
                      alt={special.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                      sizes="(max-width: 768px) 100vw, 33vw"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/50">
                      <Star className="w-12 h-12 opacity-30" />
                    </div>
                  )}
                  {/* Number badge, on the photo */}
                  <div className="absolute top-4 left-4 w-10 h-10 rounded-full bg-secondary text-white flex items-center justify-center font-bold text-lg shadow-lg">
                    {index + 1}
                  </div>
                </div>

                <div className="p-6 sm:p-8 flex flex-col flex-1">
                  {/* Badge */}
                  {special.badge === "Best Seller" && (
                    <div className="flex items-center gap-1.5 mb-2">
                      <Flame className="w-5 h-5 text-secondary" />
                      <span className="text-secondary text-sm font-semibold">Best Seller</span>
                    </div>
                  )}
                  {special.badge === "Chef's Favorite" && (
                    <div className="flex items-center gap-1.5 mb-2">
                      <Award className="w-5 h-5 text-secondary" />
                      <span className="text-secondary text-sm font-semibold">Chef&apos;s Favorite</span>
                    </div>
                  )}
                  {special.badge === "House Special" && (
                    <div className="flex items-center gap-1.5 mb-2">
                      <Star className="w-5 h-5 text-secondary" />
                      <span className="text-secondary text-sm font-semibold">House Special</span>
                    </div>
                  )}

                  {/* Dish Name + Price */}
                  <div className="flex items-baseline justify-between gap-3 mb-3">
                    <h3 className="font-heading text-2xl font-bold text-white group-hover:text-secondary transition-colors">
                      {special.name}
                    </h3>
                    {special.price != null && (
                      <p className="text-secondary font-semibold text-lg shrink-0">
                        {formatPrice(special.price)}
                      </p>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-white/70 text-sm leading-relaxed">
                    {special.reason}
                  </p>

                  {special.href && (
                    <span className="mt-auto pt-6 inline-flex items-center gap-2 text-sm font-semibold text-secondary group-hover:gap-3 transition-all">
                      Order this dish
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  )}
                </div>
              </>
            );

            const cardClass =
              "group reveal relative flex flex-col bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl overflow-hidden hover:bg-white/15 hover:border-secondary/40 transition-all duration-300";

            return special.href ? (
              <Link key={special.id} href={special.href} className={cardClass}>
                {card}
              </Link>
            ) : (
              <div key={special.id} className={cardClass}>
                {card}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}