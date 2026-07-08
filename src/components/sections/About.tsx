import { Award, Leaf, Heart, Users } from "lucide-react";
import Image from "next/image";
import { getRestaurantData } from "@/lib/data";

/**
 * About Section
 * 
 * WHAT IT DOES:
 * - Restaurant story/description with photo
 * - 4 highlight cards (Experienced Chefs, Fresh Ingredients, Made with Love, Family Friendly)
 * - Each card has an icon, title, and description
 * 
 * VISUAL:
 * - Two-column layout: text left, photo right
 * - 2x2 grid of highlight cards below
 * - Each card has hover effect
 */

const iconMap: Record<string, React.ReactNode> = {
  "chef-hat": <Award className="w-8 h-8" />,
  "leaf": <Leaf className="w-8 h-8" />,
  "heart": <Heart className="w-8 h-8" />,
  "users": <Users className="w-8 h-8" />,
};

export default function About() {
  const { about } = getRestaurantData();

  return (
    <section id="about" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Two-column: Text + Photo */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center mb-16">
          {/* Left: Text */}
          <div>
            <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold text-primary mb-6">
              {about.headline}
            </h2>
            <p className="text-text-light text-lg leading-relaxed">
              {about.description}
            </p>
          </div>

                   {/* Right: Photo */}
          {about.image && (
            <div className="relative">
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-lg">
                <Image
                  src={about.image}
                  alt={about.headline || "About our restaurant"}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  priority
                />
              </div>
              {/* Decorative accent bar */}
              <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-accent/20 rounded-2xl -z-10" />
            </div>
          )}
        </div>

        {/* Highlight Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {about.highlights.map((card, index) => (
            <div
              key={index}
              className="group bg-cream rounded-2xl p-8 text-center transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
            >
              {/* Icon */}
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-6 group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                {iconMap[card.icon] || <Award className="w-8 h-8" />}
              </div>

              {/* Title */}
              <h3 className="font-heading text-xl font-bold text-primary mb-3">
                {card.title}
              </h3>

              {/* Description */}
              <p className="text-text-light text-sm leading-relaxed">
                {card.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}