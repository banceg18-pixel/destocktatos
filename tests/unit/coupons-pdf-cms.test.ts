import { describe, expect, it } from "vitest";
import type { Order, OrderItem } from "@prisma/client";
import { decode, htmlToSections } from "@/lib/cms/wordpress";
import { computeDiscount } from "@/lib/server/coupons";
import { bankDetailsOf } from "@/lib/bank";
import { buildInvoicePdf, invoiceAvailable, invoiceNumber } from "@/lib/server/invoice";
import { rateLimit, resetRateLimits } from "@/lib/server/rate-limit";

describe("coupons : réduction plafonnée à 10 % de la commande", () => {
  it("pourcentage sous le plafond", () => {
    const r = computeDiscount({ type: "POURCENTAGE", value: 10 }, 100_000);
    expect(r).toMatchObject({ discountCents: 10_000, capped: false });
    expect(r.message).toContain("10%");
  });

  it("pourcentage au-delà du plafond", () => {
    expect(computeDiscount({ type: "POURCENTAGE", value: 15 }, 100_000)).toMatchObject({ discountCents: 10_000, capped: true });
  });

  it("montant fixe plafonné", () => {
    const r = computeDiscount({ type: "MONTANT", value: 2_000 }, 10_000);
    expect(r).toMatchObject({ discountCents: 1_000, capped: true });
    expect(r.message).toContain("plafonnée à 10 %");
  });

  it("montant fixe sous le plafond", () => {
    expect(computeDiscount({ type: "MONTANT", value: 2_000 }, 50_000)).toMatchObject({ discountCents: 2_000, capped: false });
  });
});

describe("facture PDF", () => {
  const order = {
    id: "o1",
    number: "TAT-20261018-ABC123",
    userId: "u1",
    status: "PAYEE",
    subtotalCents: 129_900,
    discountCents: 0,
    deliveryFeeCents: 4_500,
    totalCents: 134_400,
    deliveryMethod: "installation",
    includeOldItemPickup: false,
    deliveryDistanceKm: 12,
    isPickupInStore: false,
    shippingAddress: { fullName: "Jean Test", address: "1 rue de Test", postalCode: "93270", city: "Sevran", phone: "0612345678" },
    billingAddress: null,
    couponCode: null,
    paymentProvider: "test",
    paymentMode: "test",
    paymentIntentId: "test_o1",
    paidAt: new Date("2026-10-18T10:00:00Z"),
    createdAt: new Date("2026-10-18T09:55:00Z"),
    updatedAt: new Date("2026-10-18T10:00:00Z"),
  } as Order;
  const items = [{ id: "i1", orderId: "o1", productId: "p1", titre: "LAVE LINGE « 9 KG » éco", marque: "LG", imagePrincipale: null, unitPriceCents: 129_900, quantity: 1, lineTotalCents: 129_900 }] as OrderItem[];

  it("numéro de facture dérivé du numéro de commande", () => {
    expect(invoiceNumber(order)).toBe("FAC-20261018-ABC123");
  });

  it("produit un PDF valide (en-tête, fin de fichier, table xref)", () => {
    const pdf = buildInvoicePdf({ ...order, items }, { name: "Jean", email: "jean@tatos.test" }, { name: "TATOS", address: "15 Rue Paul Langevin", city: "93270 Sevran", email: "x@tatos.test", phone: "0600000000" });
    const s = pdf.toString("latin1");
    expect(s.startsWith("%PDF-")).toBe(true);
    expect(s.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(s).toContain("xref");
    // Texte accentué encodé en WinAnsi (é = \351 ou octet 0xE9), pas en UTF-8 brut.
    expect(s).not.toContain("Ã©");
    expect(s).toContain("FAC-20261018-ABC123");
  });

  it("commande en attente de virement : facture disponible, coordonnées bancaires et référence imprimées", () => {
    const pending = { ...order, status: "EN_ATTENTE_VIREMENT", paymentProvider: "virement", paidAt: null } as Order;
    expect(invoiceAvailable(pending)).toBe(true);
    expect(invoiceAvailable({ ...order, status: "EN_ATTENTE_PAIEMENT", paidAt: null })).toBe(false);
    const bank = bankDetailsOf({ siteName: "Destocktatos", bankIban: "fr76 3000 6000 0112 3456 7890 189", bankBic: "agrifrpp", bankName: "Banque Test" });
    expect(bank).toEqual({ holder: "Destocktatos", bank: "Banque Test", iban: "FR76 3000 6000 0112 3456 7890 189", bic: "AGRIFRPP" });
    expect(bankDetailsOf({ siteName: "Destocktatos", bankIban: "  " })).toBeNull();
    const s = buildInvoicePdf({ ...pending, items }, { name: "Jean", email: "jean@tatos.test" }, { name: "Destocktatos", address: "1 rue", city: "93270 Sevran", email: "x@tatos.test", phone: "0600000000" }, bank).toString("latin1");
    expect(s).toContain("FR76 3000 6000 0112 3456 7890 189");
    expect(s).toContain("AGRIFRPP");
    expect(s).toContain("TAT-20261018-ABC123");
  });
});

describe("WordPress : découpage des pages", () => {
  it("sections <h2> conservant le HTML d'origine (classes incluses)", () => {
    const html = '<h2>Article 1 &#8211; Objet</h2>\n<p class="mb-3">Texte &amp; suite</p><ul><li>a</li></ul>\n<h2>Article 2</h2>';
    expect(htmlToSections(html)).toEqual([
      { title: "Article 1 – Objet", blocks: [{ type: "html", html: '<p class="mb-3">Texte &amp; suite</p><ul><li>a</li></ul>' }] },
      { title: "Article 2", blocks: [] },
    ]);
  });

  it("décodage des entités nommées et numériques", () => {
    expect(decode("L&rsquo;&eacute;t&#233; &#x2013; 10&nbsp;&euro; <b>gras</b>")).toBe("L’&eacute;té – 10 € gras");
  });
});

describe("limitation de débit", () => {
  it("bloque au-delà de la limite puis indique le délai", () => {
    resetRateLimits();
    expect(rateLimit("k", 2, 60_000).ok).toBe(true);
    expect(rateLimit("k", 2, 60_000).ok).toBe(true);
    const r = rateLimit("k", 2, 60_000);
    expect(r.ok).toBe(false);
    expect(r.retryAfter).toBeGreaterThan(0);
    expect(rateLimit("autre", 2, 60_000).ok).toBe(true);
  });
});
