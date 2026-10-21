import { describe, expect, it } from "vitest";
import { billingSchema, createOrderSchema } from "@/lib/server/order-schemas";
import { addressSchema, emailSchema, passwordSchema, reviewSchema } from "@/lib/validation";

const address = { fullName: "Jean Test", address: "1 rue de Test", city: "Sevran", postalCode: "93270", phone: "06 51 64 41 84" };
const firstError = (r: { success: boolean; error?: { issues: { message: string }[] } }) => r.error?.issues[0]?.message;

describe("adresse", () => {
  it("accepte une adresse valide et applique les valeurs par défaut", () => {
    const r = addressSchema.parse(address);
    expect(r.floor).toBe(0);
    expect(r.additionalInfo).toBe("");
    expect(r.isDefault).toBe(false);
  });

  it.each(["0651644184", "06.51.64.41.84", "06-51-64-41-84", "01 23 45 67 89", "+33651644184", "+33 6 51 64 41 84"])("téléphone valide %s", (phone) => {
    expect(addressSchema.safeParse({ ...address, phone }).success).toBe(true);
  });

  it.each(["+44 20 7946 0958", "6516441", "00 51 64 41 84", "abc"])("téléphone invalide %s", (phone) => {
    expect(firstError(addressSchema.safeParse({ ...address, phone }))).toMatch(/téléphone/i);
  });

  it("code postal sur 5 chiffres", () => {
    expect(firstError(addressSchema.safeParse({ ...address, postalCode: "9327" }))).toBe("Le code postal doit contenir 5 chiffres");
  });

  it("étage borné entre 0 et 10", () => {
    expect(addressSchema.safeParse({ ...address, floor: 11 }).success).toBe(false);
    expect(addressSchema.parse({ ...address, floor: "4" }).floor).toBe(4);
  });
});

describe("compte", () => {
  it("mot de passe : 8 caractères, une lettre et un chiffre", () => {
    expect(passwordSchema.safeParse("abcdefg1").success).toBe(true);
    expect(firstError(passwordSchema.safeParse("abc1"))).toMatch(/8 caractères/);
    expect(firstError(passwordSchema.safeParse("abcdefgh"))).toMatch(/chiffre/);
    expect(firstError(passwordSchema.safeParse("12345678"))).toMatch(/lettre/);
  });

  it("email normalisé en minuscules", () => {
    expect(emailSchema.parse("  Client@Exemple.FR ")).toBe("client@exemple.fr");
    expect(emailSchema.safeParse("pas-un-email").success).toBe(false);
  });
});

describe("avis", () => {
  it("note entière de 1 à 5", () => {
    expect(reviewSchema.parse({ produit: "p1", note: "5" }).note).toBe(5);
    expect(firstError(reviewSchema.safeParse({ produit: "p1", note: 0 }))).toBe("Veuillez attribuer une note");
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
    const ok = { name: "Jean", email: "J@X.FR", address: "1 rue", postalCode: "93270", city: "Sevran", phone: "0612345678" };
    expect(billingSchema.parse(ok)).toMatchObject({ email: "j@x.fr", country: "FR" });
    expect(billingSchema.safeParse({ ...ok, postalCode: "ABCDE" }).success).toBe(false);
  });
});
