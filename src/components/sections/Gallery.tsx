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
 * Those six were then replaced too: they were AI-generated, and looked it. The
 * grid now shows our own dish photographs, the same ones the menu uses. Indices
 * 0 and 3 are the wide tiles (see WIDE_TILES), so they hold landscape shots.
 */

const galleryImages: GalleryImage[] = [
  { src: "/images/dishes/menu-56-malai-chicken-kabab.jpg", alt: "Malai chicken kabab, sizzling from the tandoor" },
  { src: "/images/dishes/menu-1-vegetable-samosa.jpg", alt: "Vegetable samosas" },
  { src: "/images/dishes/menu-57-tandoori-chicken.jpg", alt: "Tandoori chicken on a sizzler plate" },
  { src: "/images/dishes/menu-115-butter-chicken.jpg", alt: "Butter chicken" },
  { src: "/images/dishes/menu-25-tikka-masala.jpg", alt: "Tikka masala" },
  { src: "/images/dishes/menu-75-garlic-naan.jpg", alt: "Garlic naan" },
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
