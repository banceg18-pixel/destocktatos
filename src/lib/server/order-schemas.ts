import { z } from "zod";
import { DE_PHONE_HINT, isDePhone, normalizeDePhone } from "@/lib/phone";
import { addressSchema, objectId } from "@/lib/validation";

export const createOrderSchema = z
  .object({
    items: z
      .array(z.object({ _id: objectId, quantity: z.coerce.number().int().min(1, "Ungültige Menge").max(50, "Menge zu groß") }))
      .min(1, "Warenkorb leer.")
      .max(50),
    totalAmount: z.coerce.number().min(0).max(1_000_000),
    deliveryFee: z.coerce.number().min(0).optional(),
    deliveryMethod: z.enum(["piedDuCamion", "livraisonPiece", "installation"]).nullable().optional(),
    includeOldItemPickup: z.boolean().optional().default(false),
    deliveryDistance: z.coerce.number().optional(),
    isPickupInStore: z.boolean(),
    shippingAddress: addressSchema.omit({ isDefault: true }).nullable().optional(),
    appliedCoupon: z.object({ code: z.string().trim().max(50) }).passthrough().nullable().optional(),
  })
  .superRefine((d, ctx) => {
    if (!d.isPickupInStore) {
      if (!d.shippingAddress)
        ctx.addIssue({
          code: "custom",
          path: ["shippingAddress"],
          message: "Ungültige Lieferadresse. Alle mit * markierten Felder sind erforderlich.",
        });
      if (!d.deliveryMethod) ctx.addIssue({ code: "custom", path: ["deliveryMethod"], message: "Bitte wählen Sie eine Versandart." });
    }
  });

export const billingSchema = z.object({
  name: z.string().trim().min(1, "Der Name ist erforderlich").max(120),
  email: z.string().trim().toLowerCase().email("Ungültige E-Mail-Adresse"),
  address: z.string().trim().min(1, "Die Adresse ist erforderlich").max(250),
  postalCode: z.string().trim().regex(/^\d{5}$/, "Die Postleitzahl muss 5 Stellen haben"),
  city: z.string().trim().min(1, "Die Stadt ist erforderlich").max(120),
  phone: z.string().trim().min(1, "Die Telefonnummer ist erforderlich").max(30).refine(isDePhone, DE_PHONE_HINT).transform(normalizeDePhone),
  country: z.string().trim().max(2).default("DE"),
});
