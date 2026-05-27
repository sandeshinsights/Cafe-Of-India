import { Camera } from "lucide-react";
import { getRestaurantData } from "@/lib/data";

/**
 * Gallery Section
 * 
 * WHAT IT DOES:
 * - Displays a grid of restaurant/food photos
 * - Currently shows placeholders (you'll add real photos later)
 * - Drop photos into public/images/gallery/ folder to populate
 * 
 * VISUAL:
 * - Clean white background
 * - Responsive grid (2 cols mobile, 3 cols tablet, 4 cols desktop)
 * - Hover effect with zoom
 */

const placeholderImages = [
  { src: "/images/gallery/placeholder-1.jpg", alt: "Restaurant interior" },
  { src: "/images/gallery/placeholder-2.jpg", alt: "Indian dishes" },
  { src: "/images/gallery/placeholder-3.jpg", alt: "Chef cooking" },
  { src: "/images/gallery/placeholder-4.jpg", alt: "Tandoor oven" },
  { src: "/images/gallery/placeholder-5.jpg", alt: "Dinner setup" },
  { src: "/images/gallery/placeholder-6.jpg", alt: "Fresh ingredients" },
  { src: "/images/gallery/placeholder-7.jpg", alt: "Naan bread" },
  { src: "/images/gallery/placeholder-8.jpg", alt: "Spice collection" },
];

export default function Gallery() {
  const { gallery } = getRestaurantData();

  // Use real gallery images if provided, otherwise show placeholders
  const images = gallery.length > 0
    ? gallery.map((src, i) => ({ src, alt: `Gallery image ${i + 1}` }))
    : placeholderImages;

  return (
    <section id="gallery" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold text-primary mb-4">
            Gallery
          </h2>
          <p className="text-text-light text-lg max-w-2xl mx-auto">
            A glimpse into our kitchen and dining experience.
          </p>
        </div>

        {/* Photo Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((image, index) => (
            <div
              key={index}
              className="group relative aspect-square rounded-xl overflow-hidden bg-cream"
            >
              {/* Placeholder (shown when no real image) */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-text-light/40">
                <Camera className="w-10 h-10 mb-2" />
                <p className="text-xs">Photo {index + 1}</p>
              </div>

              {/* Real Image (shown when photo exists) */}
              <img
                src={image.src}
                alt={image.alt}
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}