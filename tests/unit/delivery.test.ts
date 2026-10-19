import { describe, expect, it } from "vitest";
import { DELIVERY_METHODS, DELIVERY_OPTIONS, STORE_COORDINATES, calculateDeliveryFee, calculateDistance, calculateTotalWeight } from "@/lib/delivery";
import { destockagePriceCents } from "@/lib/destockage";

describe("livraison offerte partout en France", () => {
  it.each(DELIVERY_METHODS)("%s : gratuit", (method) => {
    expect(DELIVERY_OPTIONS[method].price).toBe(0);
    expect(calculateDeliveryFee(method)).toBe(0);
  });

  it("reprise de l'ancien appareil offerte avec l'installation", () => {
    expect(calculateDeliveryFee("installation", true)).toBe(0);
  });

  it("sans méthode choisie, pas de frais", () => {
    expect(calculateDeliveryFee(null)).toBe(0);
  });
});

describe("prix de déstockage", () => {
  const pct = (id: string, euros: number) => Math.round((1 - destockagePriceCents(id, euros * 100) / (euros * 100)) * 100);
  const ids = Array.from({ length: 40 }, (_, i) => `produit-${i}`);

  it.each([
    [499, 60, 80],
    [500, 40, 60],
    [1999, 40, 60],
    [2000, 30, 50],
    [4500, 30, 50],
  ])("à %i € : remise entre %i et %i %%", (euros, min, max) => {
    for (const id of ids) {
      const p = pct(id, euros);
      expect(p).toBeGreaterThanOrEqual(min);
      expect(p).toBeLessThanOrEqual(max);
    }
  });

  it("prix stable pour un même produit et terminé par ,99", () => {
    expect(destockagePriceCents("abc", 89_900)).toBe(destockagePriceCents("abc", 89_900));
    expect(destockagePriceCents("abc", 89_900) % 100).toBe(99);
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
