import { describe, expect, it } from "vitest";
import {
  STORE_COORDINATES,
  calculateDeliveryFee,
  calculateDistance,
  calculateFloorFees,
  calculateTotalWeight,
  getDeliveryOptions,
} from "@/lib/delivery";

describe("grille de livraison (règles du site source)", () => {
  it.each([
    [0, 30, 35, 45],
    [20, 30, 35, 45],
    [21, 40, 45, 55],
    [40, 40, 45, 55],
    [41, 50, 55, 65],
    [60, 50, 55, 65],
    [61, 65, 70, 80],
    [80, 65, 70, 80],
  ])("à %i km : pied du camion %i €, pièce %i €, installation %i €", (km, pied, piece, install) => {
    const o = getDeliveryOptions(km)!;
    expect(o.piedDuCamion.price).toBe(pied);
    expect(o.livraisonPiece.price).toBe(piece);
    expect(o.installation.price).toBe(install);
    expect(o.installation.additionalFee).toBe(5);
  });

  it("aucune livraison au-delà de 80 km", () => {
    expect(getDeliveryOptions(81)).toBeNull();
    expect(calculateDeliveryFee(81, "piedDuCamion")).toBe(0);
  });

  it("reprise de l'ancien appareil : +5 € uniquement avec l'installation", () => {
    expect(calculateDeliveryFee(10, "installation", true)).toBe(50);
    expect(calculateDeliveryFee(10, "installation", false)).toBe(45);
    expect(calculateDeliveryFee(10, "piedDuCamion", true)).toBe(30);
  });

  it("sans méthode choisie, pas de frais", () => {
    expect(calculateDeliveryFee(10, null)).toBe(0);
  });
});

describe("frais d'étage", () => {
  it.each([
    [0, 50, 0],
    [2, 50, 0],
    [3, 50, 10],
    [5, 19.9, 10],
    [5, 20, 30],
    [10, 100, 80],
  ])("étage %i, %f kg -> %i €", (floor, kg, fee) => {
    expect(calculateFloorFees(floor, kg)).toBe(fee);
  });

  it("s'ajoutent au tarif de livraison", () => {
    expect(calculateDeliveryFee(30, "livraisonPiece", false, 4, 25)).toBe(45 + 20);
  });
});

describe("poids et distance", () => {
  it("poids total = somme poids × quantité (poids ou weight)", () => {
    expect(calculateTotalWeight([{ quantity: 2, poids: 30 }, { quantity: 1, weight: 5 }, { quantity: 3 }])).toBe(65);
  });

  it("distance Haversine arrondie au km", () => {
    expect(calculateDistance(STORE_COORDINATES.lat, STORE_COORDINATES.lng, STORE_COORDINATES.lat, STORE_COORDINATES.lng)).toBe(0);
    // 0,5° de latitude ≈ 55,6 km
    expect(calculateDistance(48.9325, 2.533, 49.4325, 2.533)).toBe(56);
    // Paris (Hôtel de Ville) -> magasin de Sevran : ~16 km
    expect(calculateDistance(48.8566, 2.3522, STORE_COORDINATES.lat, STORE_COORDINATES.lng)).toBeGreaterThanOrEqual(14);
    expect(calculateDistance(48.8566, 2.3522, STORE_COORDINATES.lat, STORE_COORDINATES.lng)).toBeLessThanOrEqual(18);
  });
});
