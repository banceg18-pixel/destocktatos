/**
 * Règles de livraison du site source (grille par distance, frais d'étage, reprise de
 * l'ancien appareil). Module pur, partagé par le panier (affichage) et par le backend
 * (calcul faisant foi lors de la création de commande).
 */

export type DeliveryMethod = "piedDuCamion" | "livraisonPiece" | "installation";

export interface DeliveryOption {
  method: DeliveryMethod;
  price: number;
  additionalFee?: number;
}

export type DeliveryOptions = Record<DeliveryMethod, DeliveryOption>;

export const DELIVERY_METHODS: DeliveryMethod[] = ["piedDuCamion", "livraisonPiece", "installation"];

/** Distance maximale livrée (km). */
export const MAX_DELIVERY_DISTANCE = 80;
/** Au-delà de cette distance seule la livraison au pied du camion est proposée (sur devis). */
export const LONG_DISTANCE_THRESHOLD = 60;

/** Coordonnées du magasin (15 Rue Paul Langevin, 93270 Sevran). */
export const STORE_COORDINATES = { lat: 48.9325, lng: 2.533 };

export const DELIVERY_RATES: Record<"0-20" | "20-40" | "40-60" | "60-80", DeliveryOptions> = {
  "0-20": {
    installation: { method: "installation", price: 45, additionalFee: 5 },
    piedDuCamion: { method: "piedDuCamion", price: 30 },
    livraisonPiece: { method: "livraisonPiece", price: 35 },
  },
  "20-40": {
    installation: { method: "installation", price: 55, additionalFee: 5 },
    piedDuCamion: { method: "piedDuCamion", price: 40 },
    livraisonPiece: { method: "livraisonPiece", price: 45 },
  },
  "40-60": {
    installation: { method: "installation", price: 65, additionalFee: 5 },
    piedDuCamion: { method: "piedDuCamion", price: 50 },
    livraisonPiece: { method: "livraisonPiece", price: 55 },
  },
  "60-80": {
    installation: { method: "installation", price: 80, additionalFee: 5 },
    piedDuCamion: { method: "piedDuCamion", price: 65 },
    livraisonPiece: { method: "livraisonPiece", price: 70 },
  },
};

function bracket(distance: number) {
  return distance > 60 ? "60-80" : distance > 40 ? "40-60" : distance > 20 ? "20-40" : "0-20";
}

/** Options disponibles pour une distance donnée (null au-delà de 80 km). */
export function getDeliveryOptions(distance: number): DeliveryOptions | null {
  if (distance > MAX_DELIVERY_DISTANCE) return null;
  return DELIVERY_RATES[bracket(distance)] ?? null;
}

/** Frais d'étage : +10 € dès le 3e étage, +10 € par étage au-delà du 3e si la commande pèse ≥ 20 kg. */
export function calculateFloorFees(floor: number, totalWeight: number): number {
  if (floor < 3) return 0;
  let fee = 10;
  if (floor > 3 && totalWeight >= 20) fee += (floor - 3) * 10;
  return fee;
}

export function calculateDeliveryFee(
  distance: number,
  method: DeliveryMethod | null | undefined,
  includeOldItemPickup = false,
  floor = 0,
  totalWeight = 0,
): number {
  if (distance > MAX_DELIVERY_DISTANCE || !method) return 0;
  const options = DELIVERY_RATES[bracket(distance)];
  const option = options?.[method];
  if (!option) return 0;
  let fee = option.price;
  if (method === "installation" && includeOldItemPickup && option.additionalFee) fee += option.additionalFee;
  return fee + calculateFloorFees(floor, totalWeight);
}

export interface WeightedItem {
  quantity: number;
  poids?: number;
  weight?: number;
}

export function calculateTotalWeight(items: WeightedItem[]): number {
  return items.reduce((sum, item) => sum + (item.poids || item.weight || 0) * item.quantity, 0);
}

/** Distance à vol d'oiseau (Haversine), arrondie au km comme sur la source. */
export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return Math.round(2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 6371);
}

/** Coupons : la réduction est plafonnée à 10 % du montant de la commande. */
export const COUPON_MAX_RATIO = 0.1;
