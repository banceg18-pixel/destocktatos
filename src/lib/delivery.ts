/**
 * Lieferregeln: Kostenlose Lieferung in ganz Deutschland, unabhängig von der Versandart
 * (Bordsteinkante, in den Raum oder mit Installation), ohne Etagenzuschlag oder Altgeräterücknahmegebühr.
 * Reines Modul, geteilt zwischen Warenkorb (Anzeige) und Backend (verbindliche Berechnung).
 */

export type DeliveryMethod = "piedDuCamion" | "livraisonPiece" | "installation";

export interface DeliveryOption {
  method: DeliveryMethod;
  price: number;
  additionalFee?: number;
}

export type DeliveryOptions = Record<DeliveryMethod, DeliveryOption>;

export const DELIVERY_METHODS: DeliveryMethod[] = ["piedDuCamion", "livraisonPiece", "installation"];

/** Standort der Filiale Berlin (Friedrichstraße 176-179, 10117 Berlin): Richtdistanz zur Lieferadresse. */
export const STORE_COORDINATES = { lat: 52.5163, lng: 13.3883 };

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
