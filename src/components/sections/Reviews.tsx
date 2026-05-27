import { Star, Quote } from "lucide-react";
import { getRestaurantData } from "@/lib/data";
import { getStars } from "@/lib/utils";

/**
 * Reviews Section
 * 
 * WHAT IT DOES:
 * - Displays 4 customer testimonials from restaurant.json
 * - Each card shows: customer name, star rating, review text, source
 * - Shows overall restaurant rating (4.7/5, 120 reviews) at the top
 * 
 * VISUAL:
 * - Light background alternating from dark specials section
 * - Quote icon decoration on each card
 * - Gold stars for ratings
 */

export default function Reviews() {
  const { testimonials, rating } = getRestaurantData();

  return (
    <section id="reviews" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header with Overall Rating */}
        <div className="text-center mb-16">
          <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold text-primary mb-4">
            What Our Guests Say
          </h2>
          <div className="flex items-center justify-center gap-3 mb-4">
            {/* Stars */}
            <div className="flex gap-1">
              {getStars(rating.value).map((star, i) => (
                <Star
                  key={i}
                  className={`w-6 h-6 ${
                    star === 1
                      ? "fill-secondary text-secondary"
                      : "fill-gray-300 text-gray-300"
                  }`}
                />
              ))}
            </div>
            <span className="text-text-main font-bold text-xl">
              {rating.value}
            </span>
            <span className="text-text-light text-lg">
              ({rating.count} reviews on {rating.source})
            </span>
          </div>
        </div>

        {/* Testimonial Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="bg-cream rounded-2xl p-8 relative hover:shadow-lg transition-shadow duration-300"
            >
              {/* Quote Icon */}
              <Quote className="w-8 h-8 text-secondary/30 absolute top-6 right-6" />

              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {getStars(testimonial.rating).map((star, i) => (
                  <Star
                    key={i}
                    className={`w-5 h-5 ${
                      star === 1
                        ? "fill-secondary text-secondary"
                        : "fill-gray-300 text-gray-300"
                    }`}
                  />
                ))}
              </div>

              {/* Review Text */}
              <p className="text-text-main leading-relaxed mb-6 italic">
                &ldquo;{testimonial.text}&rdquo;
              </p>

              {/* Author Info */}
              <div className="flex items-center gap-3">
                {/* Avatar Placeholder */}
                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white font-bold text-lg">
                  {testimonial.name.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-primary">{testimonial.name}</p>
                  <p className="text-text-light text-sm">via {testimonial.source}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}