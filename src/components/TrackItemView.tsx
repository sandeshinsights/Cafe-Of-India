"use client";

import { useEffect } from "react";
import { trackMeta } from "@/lib/meta-pixel";
import { trackGoogle } from "@/lib/google-tag";

/**
 * Fires Meta ViewContent and GA4 view_item once when a per-dish page
 * (`/menu/<slug>`) mounts. That page is a server component, so the tracking
 * needs this client-side island. Same payload shape as the homepage menu's
 * ViewContent in Menu.tsx, so ad audiences treat both entry points alike.
 */
export default function TrackItemView({
  id,
  name,
  category,
  price,
}: {
  id: string;
  name: string;
  category: string;
  price: number;
}) {
  useEffect(() => {
    trackMeta("ViewContent", {
      content_ids: [id],
      content_name: name,
      content_type: "product",
      content_category: category,
      value: price,
      currency: "USD",
    });
    trackGoogle("view_item", {
      currency: "USD",
      value: price,
      items: [
        { item_id: id, item_name: name, item_category: category, price, quantity: 1 },
      ],
    });
  }, [id, name, category, price]);

  return null;
}
