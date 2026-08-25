import GalleryGrid, { type GalleryImage } from "@/components/GalleryGrid";

/**
 * Gallery Section
 *
 * FOOD ONLY, DELIBERATELY.
 *
 * This used to show eight photos under the heading "a glimpse into our kitchen
 * and dining experience". Two of them made claims about the premises that were
 * not true: gallery-5 was an ornate crimson dining room that is not this
 * restaurant (compare about/restaurant-interior.jpg, which is), and gallery-7
 * was an Indian street spice market presented as our kitchen. Both are dropped.
 *
 * What is left is six dish photographs, captioned by dish. Illustrative food
 * photography of things that really are on the menu is ordinary restaurant
 * practice; a photograph of a dining room the customer will never walk into is
 * not. The section copy talks about the food for the same reason.
 *
 * The two dropped files are still in public/images/gallery/ — unreferenced, and
 * safe to delete or replace with real photographs of the restaurant.
 */

const galleryImages: GalleryImage[] = [
  { src: "/images/gallery/gallery-1.jpg", alt: "Thali platter with curries, rice and breads" },
  { src: "/images/gallery/gallery-2.jpg", alt: "Garlic naan, fresh from the tandoor" },
  { src: "/images/gallery/gallery-3.jpg", alt: "Chicken tikka masala in a clay pot" },
  { src: "/images/gallery/gallery-8.jpg", alt: "Tandoori mixed grill platter" },
  { src: "/images/gallery/gallery-4.jpg", alt: "Vegetable samosa and pakora platter" },
  { src: "/images/gallery/gallery-6.jpg", alt: "Mango lassi and gulab jamun" },
];

export default function Gallery() {
  return (
    <section id="gallery" className="py-20 sm:py-24 bg-ink">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12 reveal">
          <p className="text-secondary text-sm font-medium tracking-[0.2em] uppercase mb-3">
            On The Menu
          </p>
          <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
            The Food
          </h2>
          <div className="w-16 h-px bg-secondary/60 mx-auto mb-4" />
          <p className="text-white/60 text-lg max-w-2xl mx-auto">
            A closer look at some of the dishes we cook fresh to order.
          </p>
        </div>

        {/* Photo Grid + lightbox */}
        <GalleryGrid images={galleryImages} />
      </div>
    </section>
  );
}
