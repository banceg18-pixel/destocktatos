import { describe, expect, it } from "vitest";
import { billingSchema, createOrderSchema } from "@/lib/server/order-schemas";
import { addressSchema, emailSchema, passwordSchema, reviewSchema } from "@/lib/validation";

const address = { fullName: "Kunde Test", address: "Friedrichstraße 15", city: "Berlin", postalCode: "10117", phone: "030 12345678" };
const firstError = (r: { success: boolean; error?: { issues: { message: string }[] } }) => r.error?.issues[0]?.message;

describe("adresse", () => {
  it("accepte une adresse valide et applique les valeurs par défaut", () => {
    const r = addressSchema.parse(address);
    expect(r.floor).toBe(0);
    expect(r.additionalInfo).toBe("");
    expect(r.isDefault).toBe(false);
  });

  it.each(["03012345678", "030.12.34.56.78", "030-12-34-56-78", "0151 23456789", "+493012345678", "+49 30 12345678"])("Telefonnummer gültig %s", (phone) => {
    expect(addressSchema.safeParse({ ...address, phone }).success).toBe(true);
  });

  it.each(["+44 20 7946 0958", "6516441", "00 51 64 41 84", "abc"])("Telefonnummer ungültig %s", (phone) => {
    expect(firstError(addressSchema.safeParse({ ...address, phone }))).toMatch(/Telefon/i);
  });

  it("code postal sur 5 chiffres", () => {
    expect(firstError(addressSchema.safeParse({ ...address, postalCode: "1011" }))).toBe("Die Postleitzahl muss 5 Stellen haben");
  });

  it("étage borné entre 0 et 10", () => {
    expect(addressSchema.safeParse({ ...address, floor: 11 }).success).toBe(false);
    expect(addressSchema.parse({ ...address, floor: "4" }).floor).toBe(4);
  });
});

describe("compte", () => {
  it("mot de passe : 8 caractères, une lettre et un chiffre", () => {
    expect(passwordSchema.safeParse("abcdefg1").success).toBe(true);
    expect(firstError(passwordSchema.safeParse("abc1"))).toMatch(/8 Zeichen/);
    expect(firstError(passwordSchema.safeParse("abcdefgh"))).toMatch(/Ziffer/);
    expect(firstError(passwordSchema.safeParse("12345678"))).toMatch(/Buchstabe/);
  });

  it("email normalisé en minuscules", () => {
    expect(emailSchema.parse("  Kunde@Beispiel.DE ")).toBe("kunde@beispiel.de");
    expect(emailSchema.safeParse("keine-email").success).toBe(false);
  });
});

describe("avis", () => {
  it("note entière de 1 à 5", () => {
    expect(reviewSchema.parse({ produit: "p1", note: "5" }).note).toBe(5);
    expect(firstError(reviewSchema.safeParse({ produit: "p1", note: 0 }))).toBe("Bitte vergeben Sie eine Bewertung");
    expect(reviewSchema.safeParse({ produit: "p1", note: 6 }).success).toBe(false);
    expect(reviewSchema.safeParse({ produit: "p1", note: 4.5 }).success).toBe(false);
  });
});

describe("commande", () => {
  const base = { items: [{ _id: "p1", quantity: 1 }], totalAmount: 100 };

  it("retrait en magasin : ni adresse ni méthode requises", () => {
    expect(createOrderSchema.safeParse({ ...base, isPickupInStore: true }).success).toBe(true);
  });

  it("livraison : adresse et méthode obligatoires", () => {
    const r = createOrderSchema.safeParse({ ...base, isPickupInStore: false });
    expect(r.success).toBe(false);
    const paths = r.error!.issues.map((i) => i.path.join("."));
    expect(paths).toEqual(expect.arrayContaining(["shippingAddress", "deliveryMethod"]));
  });

  it("quantités et méthodes invalides refusées", () => {
    expect(createOrderSchema.safeParse({ ...base, items: [{ _id: "p1", quantity: 0 }], isPickupInStore: true }).success).toBe(false);
    expect(createOrderSchema.safeParse({ ...base, items: [], isPickupInStore: true }).success).toBe(false);
    expect(createOrderSchema.safeParse({ ...base, isPickupInStore: false, deliveryMethod: "drone", shippingAddress: address }).success).toBe(false);
  });

  it("facturation", () => {
    const ok = { name: "Kunde", email: "K@X.DE", address: "Friedrichstraße 15", postalCode: "10117", city: "Berlin", phone: "03012345678" };
    expect(billingSchema.parse(ok)).toMatchObject({ email: "k@x.de", country: "DE" });
    expect(billingSchema.safeParse({ ...ok, postalCode: "ABCDE" }).success).toBe(false);
  });
});
