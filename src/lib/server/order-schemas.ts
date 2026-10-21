import { z } from "zod";
import { FR_PHONE_HINT, isFrPhone, normalizeFrPhone } from "@/lib/phone";
import { addressSchema, objectId } from "@/lib/validation";

export const createOrderSchema = z
  .object({
    items: z
      .array(z.object({ _id: objectId, quantity: z.coerce.number().int().min(1, "Quantité invalide").max(50, "Quantité trop importante") }))
      .min(1, "Panier vide.")
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
          message: "Adresse de livraison invalide. Tous les champs marqués d'un * sont obligatoires.",
        });
      if (!d.deliveryMethod) ctx.addIssue({ code: "custom", path: ["deliveryMethod"], message: "Veuillez sélectionner une méthode de livraison." });
    }
  });

export const billingSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis").max(120),
  email: z.string().trim().toLowerCase().email("Adresse email invalide"),
  address: z.string().trim().min(1, "L'adresse est requise").max(250),
  postalCode: z.string().trim().regex(/^\d{5}$/, "Le code postal doit contenir 5 chiffres"),
  city: z.string().trim().min(1, "La ville est requise").max(120),
  phone: z.string().trim().min(1, "Le téléphone est requis").max(30).refine(isFrPhone, FR_PHONE_HINT).transform(normalizeFrPhone),
  country: z.string().trim().max(2).default("FR"),
});
