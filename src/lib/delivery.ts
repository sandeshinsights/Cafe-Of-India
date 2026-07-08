/**
 * Delivery Configuration & Uber Direct Integration
 *
 * DELIVERY_CONFIG: All delivery settings in one place.
 * - To add restaurant subsidy later: change subsidyAmount
 * - feeType "uber_quote": calls getDeliveryQuote() for address-based pricing
 * - To switch back to flat: change feeType to "flat"
 *
 * getDeliveryQuote(): Currently a MOCK — returns flat fee estimate.
 * Replace the TODO block with real Uber Direct quote API when credentials are ready.
 *
 * createDelivery(): Currently a MOCK — logs to console and returns success.
 * Replace the TODO block with real Uber Direct delivery API when credentials are ready.
 *
 * ONLY this file needs to change for real Uber Direct integration.
 * No other files in the project call Uber's API directly.
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
 * Currently a MOCK — returns flat fee as estimate.
 * CartDrawer calls this async when customer types their address.
 *
 * When Uber Direct credentials are ready, replace the TODO block
 * with a real POST to /v1.2/deliveries/quote.
 */
export async function getDeliveryQuote(address: string): Promise<DeliveryFeeResult & { error?: string }> {
  // =============================================
  // TODO: Replace mock with real Uber Direct quote
  // =============================================
  //
  // 1. Get OAuth token:
  //    POST https://login.uber.com/oauth/v2/token
  //    { client_id, client_secret, grant_type: "client_credentials", scope: "eats.deliveries" }
  //
  // 2. Get delivery quote:
  //    POST https://api.uber.com/v1.2/deliveries/quote
  //    Headers: Authorization: Bearer <token>
  //    Body: {
  //      pickup: { address: DELIVERY_CONFIG.restaurantAddress },
  //      dropoff: { address: address },
  //    }
  //
  // 3. Return the fee from the quote response.
  //    If quote fails (out of range, etc.), return { fee: 0, error: "Out of delivery area" }

  // Mock: use flat fee as estimate
  const fee = DELIVERY_CONFIG.flatFee;
  const customerPays = Math.max(0, fee - DELIVERY_CONFIG.subsidyAmount);
  return { fee, customerPays, restaurantPays: DELIVERY_CONFIG.subsidyAmount };
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
 *
 * Currently a MOCK — logs to console and returns success.
 * When the owner gets Uber Direct API credentials, replace the
 * TODO block below with real API calls.
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

  // =============================================
  // TODO: Replace mock with real Uber Direct API
  // =============================================
  //
  // 1. Get OAuth token (same as in getDeliveryQuote)
  //
  // 2. Create the delivery:
  //    POST https://api.uber.com/v1.2/deliveries
  //    Headers: Authorization: Bearer <token>
  //    Body: {
  //      pickup: {
  //        location: { address: DELIVERY_CONFIG.restaurantAddress },
  //        contact: { name: "Cafe of India", phone: "(978) 897-9227" }
  //      },
  //      dropoff: {
  //        location: { address: fullAddress },
  //        contact: { name: params.customerName, phone: params.customerPhone }
  //      }
  //    }
  //
  // 3. Return deliveryId + trackingUrl from the response.
  //
  // Auth: Bearer token from UBER_DIRECT_CLIENT_ID / UBER_DIRECT_CLIENT_SECRET
  // Docs: https://developer.uber.com/docs/deliveries/overview

  console.log(`[Delivery] Mock: delivery dispatched successfully`);
  return {
    success: true,
    deliveryId: `mock-${Date.now()}`,
    trackingUrl: undefined,
  };
}