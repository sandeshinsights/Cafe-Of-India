import { Star, Quote, ExternalLink } from "lucide-react";
import { getRestaurantData } from "@/lib/data";
import { getStars, mapsSearchUrl } from "@/lib/utils";

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
 * - Phones: a swipeable row (scroll-snap) instead of four stacked cards, which
 *   was several screens of scrolling for four quotes
 * - A link out to the full set of reviews on Google, so four hand-picked
 *   quotes read as a sample rather than the whole story
 */

export default function Reviews() {
  const { testimonials, rating, name, address } = getRestaurantData();

  return (
    <section id="reviews" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header with Overall Rating */}
        <div className="text-center mb-16">
          <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold text-primary mb-4">
            What Our Guests Say
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 mb-4">
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
            <span className="text-text-light text-lg whitespace-nowrap">
              ({rating.count} reviews on {rating.source})
            </span>
          </div>
        </div>

        {/* Testimonial Cards */}
        <div className="-mx-4 px-4 flex gap-4 overflow-x-auto snap-x snap-mandatory no-scrollbar pb-2 md:mx-0 md:px-0 md:grid md:grid-cols-2 md:gap-8 md:overflow-visible md:pb-0">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="bg-cream rounded-2xl p-6 sm:p-8 relative hover:shadow-lg transition-shadow duration-300 shrink-0 w-[85%] snap-center md:w-auto"
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

        {/* Link out to every review */}
        <div className="text-center mt-10">
          <a
            href={mapsSearchUrl(`${name}, ${address.full}`)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 border border-primary/20 text-primary hover:bg-primary hover:text-white px-6 py-3 rounded-full font-semibold transition-colors"
          >
            Read all {rating.count} reviews on {rating.source}
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </section>
  );
}