import { describe, expect, it } from "vitest";
import { discountPercent, formatEuros, toCents, toEuros } from "@/lib/money";
import { displayTitle, normalize, slugify } from "@/lib/text";

describe("montants", () => {
  it("conversion euros <-> centimes sans erreur d'arrondi flottant", () => {
    expect(toCents(19.99)).toBe(1999);
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toEuros(1999)).toBe(19.99);
    expect(toEuros(toCents(1234.56))).toBe(1234.56);
  });

  it("format unique des prix : deux décimales, séparateurs français", () => {
    // Espace fine insécable (U+202F) pour les milliers, espace insécable (U+00A0) avant l'euro.
    expect(formatEuros(379)).toBe("379,00 €");
    expect(formatEuros(1234.5)).toBe("1 234,50 €");
    expect(formatEuros(0)).toBe("0,00 €");
  });

  it("pourcentage de remise arrondi, nul sans promotion valable", () => {
    expect(discountPercent(1000, 750)).toBe(25);
    expect(discountPercent(742, 359)).toBe(52);
    expect(discountPercent(500, null)).toBe(0);
    expect(discountPercent(500, 0)).toBe(0);
    expect(discountPercent(500, 600)).toBe(0);
  });
});

describe("texte", () => {
  it("normalize : minuscules, sans accents, espaces retirés", () => {
    expect(normalize("  Réfrigérateur ")).toBe("refrigerateur");
    expect(normalize("CONGÉLATEUR")).toBe("congelateur");
    expect(normalize(null)).toBe("");
  });

  it("slugify", () => {
    expect(slugify("plaque à gaz")).toBe("plaque-a-gaz");
    expect(slugify("  Lave--Linge ! ")).toBe("lave-linge");
    expect(slugify("Micro-ondes & grill")).toBe("micro-ondes-grill");
  });

  it("displayTitle : titres en capitales passés en casse de phrase, références et marque conservées", () => {
    expect(displayTitle("LAVE LINGE 13KG")).toBe("Lave linge 13KG");
    expect(displayTitle("FOUR ENCASTRABLE CANDY 70L", "CANDY")).toBe("Four encastrable CANDY 70L");
    expect(displayTitle("plaque à induction encastrable")).toBe("Plaque à induction encastrable");
    expect(displayTitle("Réfrigérateur multi portes LG")).toBe("Réfrigérateur multi portes LG");
    expect(displayTitle("  ")).toBe("");
  });
});
