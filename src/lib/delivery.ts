/**
 * Delivery Configuration & Uber Direct Integration
 *
 * DELIVERY_CONFIG: All delivery settings in one place.
 * - To add restaurant subsidy later: change subsidyAmount
 * - feeType "uber_quote": calls our API route for address-based pricing from Uber Direct
 * - To switch back to flat: change feeType to "flat"
 *
 * getDeliveryQuote(): Calls /api/delivery/quote which talks to Uber Direct.
 * Falls back to flat fee if the API is unreachable.
 *
 * createDelivery(): Calls /api/delivery/create which talks to Uber Direct.
 * Falls back to mock (console log) if the API is unreachable.
 *
 * ONLY the API routes in src/app/api/delivery/ call Uber's API directly (via uber-direct.ts).
 * This file never touches Uber directly — it only calls our own API routes.
 */

export const DELIVERY_CONFIG = {
  enabled: true,

  // Fee configuration
  feeType: "uber_quote" as "flat" | "uber_quote" | "distance",
  flatFee: 6.99,
  subsidyAmount: 0, // Future: restaurant covers part of the fee

  // Order requirements
  minOrderAmount: 20,

  // Delivery area (used when Google Places is integrated)
  maxRadiusMiles: 10,
  restaurantAddress: "155 Main Street, Maynard, MA 01754",
  restaurantLat: 42.4331,
  restaurantLng: -71.4505,
};

export interface DeliveryFeeResult {
  fee: number; // Total delivery cost
  customerPays: number; // What appears on customer receipt
  restaurantPays: number; // What restaurant subsidizes
}

/**
 * Calculate delivery fee (synchronous, used as fallback).
 * When feeType is "uber_quote", use getDeliveryQuote() instead.
 */
export function getDeliveryFee(): DeliveryFeeResult {
  const fee = DELIVERY_CONFIG.flatFee;
  const customerPays = Math.max(0, fee - DELIVERY_CONFIG.subsidyAmount);
  const restaurantPays = DELIVERY_CONFIG.subsidyAmount;
  return { fee, customerPays, restaurantPays };
}

/**
 * Get a delivery quote for a specific address.
 * Calls our own API route which talks to Uber Direct.
 * Falls back to flat fee if the API is unreachable.
 *
 * CartDrawer calls this async when customer types their address.
 */
export async function getDeliveryQuote(address: string): Promise<DeliveryFeeResult & { error?: string }> {
  try {
    const res = await fetch("/api/delivery/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    });

    const data = await res.json();

    if (!res.ok) {
      // Out of delivery area or bad request
      return {
        fee: 0,
        customerPays: 0,
        restaurantPays: 0,
        error: data.error || "Could not get delivery quote",
      };
    }

    return {
      fee: data.fee,
      customerPays: data.customerPays,
      restaurantPays: data.restaurantPays,
    };
  } catch {
    // Network error — can't verify address is deliverable, block checkout
    console.error("[getDeliveryQuote] Delivery API unreachable");
    return {
      fee: 0,
      customerPays: 0,
      restaurantPays: 0,
      error: "Delivery service temporarily unavailable. Please try again or call us at (978) 897-9227.",
    };
  }
}

/**
 * Check if cart subtotal meets the delivery minimum.
 */
export function isEligibleForDelivery(subtotal: number): {
  eligible: boolean;
  message?: string;
} {
  if (subtotal < DELIVERY_CONFIG.minOrderAmount) {
    return {
      eligible: false,
      message: `Minimum order $${DELIVERY_CONFIG.minOrderAmount} for delivery (your subtotal is $${subtotal.toFixed(2)})`,
    };
  }
  return { eligible: true };
}

/**
 * Basic address validation.
 * Enhanced with Google Places autocomplete later.
 */
export function validateDeliveryAddress(address: string): {
  valid: boolean;
  message?: string;
} {
  if (!address || address.trim().length < 10) {
    return { valid: false, message: "Please enter a full street address" };
  }
  return { valid: true };
}

/**
 * Dispatch a delivery via Uber Direct.
 * Calls our own API route which talks to Uber Direct.
 * Falls back to mock (console log) if the API is unreachable.
 */
export async function createDelivery(params: {
  orderId: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryApt?: string;
  deliveryInstructions?: string;
}): Promise<{
  success: boolean;
  deliveryId?: string;
  trackingUrl?: string;
  error?: string;
}> {
  const fullAddress = [params.deliveryAddress, params.deliveryApt]
    .filter(Boolean)
    .join(", ");

  console.log(`[Delivery] Creating delivery for order ${params.orderId}`);
  console.log(`[Delivery] To: ${fullAddress}`);
  console.log(`[Delivery] Customer: ${params.customerName} (${params.customerPhone})`);
  if (params.deliveryInstructions) {
    console.log(`[Delivery] Instructions: ${params.deliveryInstructions}`);
  }

  try {
    const res = await fetch("/api/delivery/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || "Delivery creation failed");
    }

    console.log(`[Delivery] Uber delivery created: ${data.deliveryId}`);
    return {
      success: true,
      deliveryId: data.deliveryId,
      trackingUrl: data.trackingUrl,
    };
  } catch (error: any) {
    console.error(`[Delivery] Uber API failed: ${error.message}`);
    console.log(`[Delivery] Falling back to manual delivery for order ${params.orderId}`);
    return {
      success: true,
      deliveryId: `manual-${Date.now()}`,
      trackingUrl: undefined,
    };
  }
}