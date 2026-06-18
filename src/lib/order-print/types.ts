export interface OrderPrintData {
  orderId: string;
  name: string;
  email: string;
  phone: string;
  items: any[];
  subtotal: number;
  tax: number;
  total: number;
  discountAmount?: number;
}

export interface FaxResult {
  success: boolean;
  attempt: number;
  error?: string;
}