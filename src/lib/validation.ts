import { z } from "zod";

/** Schémas de validation partagés (serveur, et réutilisables côté client). */

export const objectId = z.string().trim().min(1, "Identifiant requis").max(64);

export const reviewSchema = z.object({
  produit: objectId,
  note: z.coerce.number().int("La note doit être un entier").min(1, "Veuillez attribuer une note").max(5, "Note maximale : 5"),
  commentaire: z.string().trim().max(2000, "Commentaire trop long (2000 caractères max)").default(""),
});

export const reviewUpdateSchema = reviewSchema.omit({ produit: true });

const phoneRegex = /^0[1-9]([-. ]?[0-9]{2}){4}$/;

export const addressSchema = z.object({
  fullName: z.string().trim().min(1, "Le nom complet est requis").max(120),
  address: z.string().trim().min(1, "L'adresse est requise").max(250),
  city: z.string().trim().min(1, "La ville est requise").max(120),
  postalCode: z
    .string()
    .trim()
    .min(1, "Le code postal est requis")
    .regex(/^\d{5}$/, "Le code postal doit contenir 5 chiffres"),
  phone: z
    .string()
    .trim()
    .min(1, "Le téléphone est requis")
    .refine((v) => phoneRegex.test(v.replace(/\s/g, "")), "Format de téléphone invalide (ex : 06 12 34 56 78)"),
  additionalInfo: z.string().trim().max(500).default(""),
  floor: z.coerce.number().int().min(0).max(10).default(0),
  isDefault: z.boolean().optional().default(false),
});

export type AddressInput = z.infer<typeof addressSchema>;

export const passwordSchema = z
  .string()
  .min(8, "Le mot de passe doit contenir au moins 8 caractères")
  .max(128, "Mot de passe trop long")
  .regex(/[A-Za-z]/, "Le mot de passe doit contenir au moins une lettre")
  .regex(/[0-9]/, "Le mot de passe doit contenir au moins un chiffre");

export const emailSchema = z.string().trim().toLowerCase().email("Adresse email invalide").max(254);
