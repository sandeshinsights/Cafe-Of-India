import { Star, Flame, Award } from "lucide-react";
import { getMenuData } from "@/lib/data";
import { formatPrice } from "@/lib/utils";

/**
 * Chef's Specials Section
 * 
 * WHAT IT DOES:
 * - Highlights 3 signature dishes from the head chef
 * - Each special shows photo, dish name, price, and why it's special
 * - Eye-catching gold/maroon design
 */

const badgeIcons: Record<string, React.ReactNode> = {
  "Best Seller": <Flame className="w-5 h-5" />,
  "Chef's Favorite": <Award className="w-5 h-5" />,
  "House Special": <Star className="w-5 h-5" />,
};

const specialPhotos: Record<string, string> = {
  "menu-31": "/images/specials/butter-chicken.jpg",
  "menu-46": "/images/specials/dal-makhani.jpg",
  "menu-62": "/images/specials/chicken-biryani.jpg",
};

export default function Specials() {
  const { chefsSpecials, categories } = getMenuData();

  // Find full menu item details for each special
  const specialDetails = chefsSpecials.map((special) => {
    const category = categories.find((cat) =>
      cat.items.some((item) => item.id === special.id)
    );
    const menuItem = category?.items.find((item) => item.id === special.id);
    const photoUrl = specialPhotos[special.id] || "";
    return { ...special, price: menuItem?.price, description: menuItem?.description, photoUrl };
  });

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
          <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            Chef&apos;s Specials
          </h2>
          <p className="text-white/80 text-lg max-w-2xl mx-auto">
            Our head chef&apos;s personal recommendations — the dishes our guests love the most.
          </p>
        </div>

        {/* Specials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {specialDetails.map((special, index) => (
            <div
              key={special.id}
              className="group relative bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl overflow-hidden hover:bg-white/15 transition-all duration-300"
            >
              {/* Number badge */}
              <div className="absolute top-4 left-4 z-10 w-10 h-10 rounded-full bg-secondary text-white flex items-center justify-center font-bold text-lg">
                {index + 1}
              </div>

              <div className="p-8 pt-16">
                {/* Dish Photo */}
                <div className="w-full h-48 bg-white/10 rounded-xl mb-6 overflow-hidden">
                  {special.photoUrl ? (
                    <img
                      src={special.photoUrl}
                      alt={special.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/50">
                      <Star className="w-12 h-12 opacity-30" />
                    </div>
                  )}
                </div>

                {/* Dish Name */}
                <h3 className="font-heading text-2xl font-bold mb-2 group-hover:text-secondary transition-colors">
                  {special.name}
                </h3>

                {/* Price */}
                {special.price != null && (
                  <p className="text-secondary font-semibold text-lg mb-3">
                    {formatPrice(special.price)}
                  </p>
                )}

                {/* Description */}
                <p className="text-white/70 text-sm leading-relaxed">
                  {special.reason}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}