import { apiFetch } from "./http";

export interface CouponValidation {
  coupon_id: string;
  couponCode: string;
  discount: number;
  message: string;
}

export function validateCoupon(couponCode: string, orderTotal: number) {
  return apiFetch<CouponValidation>("/api/loyalty/validate", { method: "POST", json: { couponCode, orderTotal } });
}
