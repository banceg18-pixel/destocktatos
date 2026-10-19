import type { ImageRef } from "./catalog";
import type { DeliveryMethod } from "@/lib/delivery";

export interface CartItem {
  _id: string;
  slug?: string;
  titre: string;
  marque: string;
  prix: number;
  promotionPrix?: number | null;
  imagePrincipale: ImageRef;
  /** Poids unitaire (kg) — sert au calcul des frais d'étage. */
  poids?: number;
  quantity: number;
}

export interface ShippingAddress {
  _id?: string;
  fullName: string;
  address: string;
  city: string;
  postalCode: string;
  phone: string;
  additionalInfo: string;
  isDefault?: boolean;
  floor: number;
}

export interface AppliedCoupon {
  coupon_id: string;
  code: string;
  discount: number;
  message: string;
}

export interface CreateOrderPayload {
  items: { _id: string; quantity: number }[];
  totalAmount: number;
  deliveryFee: number;
  deliveryMethod: DeliveryMethod | null;
  includeOldItemPickup: boolean;
  deliveryDistance: number;
  isPickupInStore: boolean;
  shippingAddress: ShippingAddress | null;
  appliedCoupon: AppliedCoupon | null;
}
