"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { getRestaurantData } from "@/lib/data";
import { cn } from "@/lib/utils";

/**
 * FAQ Section
 * 
 * WHAT IT DOES:
 * - Accordion-style Q&A with 6 common questions
 * - Click a question to expand/collapse the answer
 * - Only one answer open at a time
 * 
 * WHY "use client":
 * - Accordion toggle needs useState
 */

export default function FAQ() {
  const { faq } = getRestaurantData();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="py-20 bg-cream-dark">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold text-primary mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-text-light text-lg">
            Everything you need to know about dining with us.
          </p>
        </div>

        {/* Accordion */}
        <div className="space-y-4">
          {faq.map((item, index) => (
            <div
              key={index}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            >
              {/* Question Button */}
              <button
                onClick={() => toggle(index)}
                className="w-full flex items-center justify-between p-6 text-left hover:bg-cream transition-colors duration-200"
              >
                <span className="font-heading text-lg font-semibold text-primary pr-4">
                  {item.question}
                </span>
                <ChevronDown
                  className={cn(
                    "w-5 h-5 text-primary flex-shrink-0 transition-transform duration-300",
                    openIndex === index && "rotate-180"
                  )}
                />
              </button>

              {/* Answer */}
              <div
                className={cn(
                  "overflow-hidden transition-all duration-300",
                  openIndex === index ? "max-h-96 pb-6" : "max-h-0"
                )}
              >
                <p className="px-6 text-text-light leading-relaxed">
                  {item.answer}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}