import { Phone, Mail, MapPin, Clock, Navigation } from "lucide-react";
import { getRestaurantData } from "@/lib/data";
import { joinNatural } from "@/lib/utils";

/**
 * Contact Section
 * 
 * WHAT IT DOES:
 * - Google Maps embed for the restaurant location
 * - Contact info: phone, email, address
 * - Business hours
 * - Service areas list
 * 
 * VISUAL:
 * - Dark maroon background
 * - Map on one side, info on the other (stacks on mobile)
 */

export default function Contact() {
  const { address, phone, phoneDisplay, email, hours, geo, serviceAreas } =
    getRestaurantData();

  const days = [
    "monday", "tuesday", "wednesday", "thursday",
    "friday", "saturday", "sunday"
  ];

  return (
    <section id="contact" className="py-20 bg-primary text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            Visit Us
          </h2>
          <p className="text-white/80 text-lg">
            We&apos;d love to welcome you. Find us at our Maynard location.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Map */}
          <div className="rounded-2xl overflow-hidden h-80 lg:h-auto min-h-[350px]">
            <iframe
              src={`https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2948.5!2d${geo.lng}!3d${geo.lat}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2z${geo.lat},${geo.lng}!5e0!3m2!1sen!2sus!4v1`}
              width="100%"
              height="100%"
              style={{ border: 0, minHeight: "350px" }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Cafe of India Location"
              className="rounded-2xl"
            />
          </div>

          {/* Contact Info */}
          <div className="space-y-8">
            {/* Address */}
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <h3 className="font-heading text-xl font-bold mb-1">Address</h3>
                <p className="text-white/80">{address.full}</p>
                <a
                  href="https://maps.google.com/?q=155+Main+Street+Maynard+MA+01754"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-secondary hover:text-secondary-light transition-colors mt-2 text-sm font-medium"
                >
                  <Navigation className="w-4 h-4" />
                  Get Directions
                </a>
              </div>
            </div>

            {/* Phone */}
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                <Phone className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <h3 className="font-heading text-xl font-bold mb-1">Phone</h3>
                <a
                  href={`tel:${phone}`}
                  className="text-white/80 hover:text-secondary transition-colors"
                >
                  {phoneDisplay}
                </a>
              </div>
            </div>

            {/* Email */}
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                <Mail className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <h3 className="font-heading text-xl font-bold mb-1">Email</h3>
                <a
                  href={`mailto:${email}`}
                  className="text-white/80 hover:text-secondary transition-colors"
                >
                  {email}
                </a>
              </div>
            </div>

            {/* Hours */}
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <h3 className="font-heading text-xl font-bold mb-2">Hours</h3>
                <div className="space-y-1">
                  {days.map((day) => (
                    <div key={day} className="flex justify-between text-sm text-white/80 gap-6">
                      <span className="capitalize">{day}</span>
                      <span>{hours[day]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Service Areas */}
            <div>
              <h3 className="font-heading text-xl font-bold mb-2">Service Areas</h3>
              <p className="text-white/70 text-sm">
                We serve the greater MetroWest area including:{" "}
                <span className="text-secondary font-medium">
                  {joinNatural(serviceAreas)}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}