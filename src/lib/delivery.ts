/**
 * Règles de livraison : gratuite partout en France, quel que soit le mode (pied du camion, dans
 * la pièce ou avec installation), sans frais d'étage ni supplément pour la reprise de l'ancien
 * appareil. Module pur, partagé par le panier (affichage) et par le backend (calcul faisant foi
 * lors de la création de commande).
 */

export type DeliveryMethod = "piedDuCamion" | "livraisonPiece" | "installation";

export interface DeliveryOption {
  method: DeliveryMethod;
  price: number;
  additionalFee?: number;
}

export type DeliveryOptions = Record<DeliveryMethod, DeliveryOption>;

export const DELIVERY_METHODS: DeliveryMethod[] = ["piedDuCamion", "livraisonPiece", "installation"];

/** Coordonnées de l'établissement (65 Rue d’Aigremont, 78300 Poissy) : distance indicative de l'adresse. */
export const STORE_COORDINATES = { lat: 48.919589, lng: 2.034745 };

/** Tarifs par mode : tous offerts. `additionalFee` : reprise de l'ancien appareil avec l'installation. */
export const DELIVERY_OPTIONS: DeliveryOptions = {
  piedDuCamion: { method: "piedDuCamion", price: 0 },
  livraisonPiece: { method: "livraisonPiece", price: 0 },
  installation: { method: "installation", price: 0, additionalFee: 0 },
};

/** Frais de livraison (€) du mode choisi, reprise de l'ancien appareil comprise. */
export function calculateDeliveryFee(method: DeliveryMethod | null | undefined, includeOldItemPickup = false): number {
  if (!method) return 0;
  const option = DELIVERY_OPTIONS[method];
  return option.price + (method === "installation" && includeOldItemPickup ? (option.additionalFee ?? 0) : 0);
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
