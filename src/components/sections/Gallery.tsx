import { getRestaurantData } from "@/lib/data";

/**
 * Gallery Section
 * 
 * WHAT IT DOES:
 * - Displays a grid of restaurant/food photos
 * - Responsive grid (2 cols mobile, 3 cols tablet, 4 cols desktop)
 * - Hover effect with zoom
 */

const galleryImages = [
  { src: "/images/gallery/gallery-1.jpg", alt: "Traditional Indian thali platter" },
  { src: "/images/gallery/gallery-2.jpg", alt: "Fresh tandoori naan bread" },
  { src: "/images/gallery/gallery-3.jpg", alt: "Chicken tikka masala" },
  { src: "/images/gallery/gallery-4.jpg", alt: "Samosa and pakora platter" },
  { src: "/images/gallery/gallery-5.jpg", alt: "Restaurant dining room" },
  { src: "/images/gallery/gallery-6.jpg", alt: "Mango lassi and gulab jamun" },
  { src: "/images/gallery/gallery-7.jpg", alt: "Traditional Indian spices" },
  { src: "/images/gallery/gallery-8.jpg", alt: "Tandoori mixed grill platter" },
];

export default function Gallery() {
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
          {galleryImages.map((image, index) => (
            <div
              key={index}
              className="group relative aspect-square rounded-xl overflow-hidden bg-cream"
            >
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