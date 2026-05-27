import { PartyPopper, Users, Building2, Cake, GraduationCap, CalendarHeart, Phone, DollarSign } from "lucide-react";
import { getRestaurantData } from "@/lib/data";
import { formatPrice } from "@/lib/utils";

/**
 * Catering Section
 * 
 * WHAT IT DOES:
 * - Displays catering services overview
 * - Shows event types we cater to
 * - Shows catering menu with small/large tray pricing
 * - Minimum order info and advance notice
 * 
 * VISUAL:
 * - Cream background
 * - Event type icons grid
 * - Catering menu organized by category
 */

const eventIcons: Record<string, React.ReactNode> = {
  "Weddings & Receptions": <PartyPopper className="w-6 h-6" />,
  "Corporate Events & Meetings": <Building2 className="w-6 h-6" />,
  "Birthday Parties": <Cake className="w-6 h-6" />,
  "Anniversaries": <CalendarHeart className="w-6 h-6" />,
  "Holiday Gatherings": <CalendarHeart className="w-6 h-6" />,
  "Community Events": <Users className="w-6 h-6" />,
};

export default function Catering() {
  const { catering, phone } = getRestaurantData();

  // Group catering menu items by category
  const categories = catering.menu.reduce<Record<string, typeof catering.menu>>(
    (acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    },
    {}
  );

  return (
    <section id="catering" className="py-20 bg-cream">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold text-primary mb-6">
            {catering.headline}
          </h2>
          <p className="text-text-light text-lg leading-relaxed">
            {catering.description}
          </p>
        </div>

        {/* Event Types Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-16">
          {catering.eventTypes.map((event) => (
            <div
              key={event}
              className="bg-white rounded-xl p-5 text-center hover:shadow-md transition-shadow duration-200 border border-gray-100"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary mb-3">
                {eventIcons[event] || <PartyPopper className="w-6 h-6" />}
              </div>
              <p className="text-sm font-medium text-text-main">{event}</p>
            </div>
          ))}
        </div>

        {/* Catering Menu */}
        <div className="mb-12">
          <h3 className="font-heading text-2xl font-bold text-primary text-center mb-8">
            Catering Menu
          </h3>
          <div className="space-y-8">
            {Object.entries(categories).map(([category, items]) => (
              <div key={category}>
                <h4 className="font-heading text-xl font-bold text-primary mb-4 pb-2 border-b-2 border-primary/20">
                  {category}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white rounded-lg p-4 border border-gray-100 hover:shadow-sm transition-shadow"
                    >
                      <h5 className="font-semibold text-text-main mb-2">{item.name}</h5>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between text-text-light">
                          <span>Small Tray</span>
                          <span className="font-semibold text-primary">{formatPrice(item.priceSmall)}</span>
                        </div>
                        <p className="text-text-light text-xs">{item.servesSmall}</p>
                        <div className="flex justify-between text-text-light pt-1 border-t border-gray-50">
                          <span>Large Tray</span>
                          <span className="font-semibold text-primary">{formatPrice(item.priceLarge)}</span>
                        </div>
                        <p className="text-text-light text-xs">{item.servesLarge}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl p-6 border border-gray-100 text-center">
            <DollarSign className="w-8 h-8 text-secondary mx-auto mb-3" />
            <h4 className="font-heading text-lg font-bold text-primary mb-1">Minimum Order</h4>
            <p className="text-text-light">{formatPrice(catering.minOrder)}</p>
          </div>
          <div className="bg-white rounded-xl p-6 border border-gray-100 text-center">
            <CalendarHeart className="w-8 h-8 text-secondary mx-auto mb-3" />
            <h4 className="font-heading text-lg font-bold text-primary mb-1">Advance Notice</h4>
            <p className="text-text-light">{catering.advanceNotice}</p>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-10">
          <a
            href={`tel:${phone}`}
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary-light text-white px-8 py-4 rounded-full text-lg font-semibold transition-colors duration-200"
          >
            <Phone className="w-5 h-5" />
            Call to Discuss Your Event
          </a>
        </div>
      </div>
    </section>
  );
}