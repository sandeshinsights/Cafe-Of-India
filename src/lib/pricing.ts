/**
 * Protein surcharge table — the single source of truth, shared by the menu UI
 * (display) and the checkout API (the actual charge).
 *
 * This used to live only in Menu.tsx, which meant the surcharge was applied to
 * the client-side cart price and then thrown away: checkout ignores client
 * prices (correctly) and recomputed from menu.json base prices, so every
 * Mutton/Lamb/Shrimp order was undercharged by the surcharge. The server must
 * apply the same table the customer was shown.
 *
 * Surcharges apply only to the "Dinner" category — the only category where the
 * UI offers a protein choice.
 */
export const PROTEIN_OPTIONS = [
  { name: "Chicken", surcharge: 0.0 },
  { name: "Mutton", surcharge: 2.0 },
  { name: "Lamb", surcharge: 2.0 },
  { name: "Shrimp", surcharge: 2.0 },
] as const;

export function getProteinSurcharge(protein: string | null | undefined): number {
  if (!protein) return 0;
  const normalized = protein.trim().toLowerCase();
  const match = PROTEIN_OPTIONS.find((p) => p.name.toLowerCase() === normalized);
  return match ? match.surcharge : 0;
}
