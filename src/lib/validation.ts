import { z } from "zod";
import { DE_PHONE_HINT, isDePhone, normalizeDePhone } from "./phone";

/** Schémas de validation partagés (serveur, et réutilisables côté client). */

export const objectId = z.string().trim().min(1, "Kennung erforderlich").max(64);

export const reviewSchema = z.object({
  produit: objectId,
  note: z.coerce.number().int("Die Bewertung muss eine ganze Zahl sein").min(1, "Bitte vergeben Sie eine Bewertung").max(5, "Höchstbewertung: 5"),
  commentaire: z.string().trim().max(2000, "Kommentar zu lang (maximal 2000 Zeichen)").default(""),
});

export const reviewUpdateSchema = reviewSchema.omit({ produit: true });


export const addressSchema = z.object({
  fullName: z.string().trim().min(1, "Der vollständige Name ist erforderlich").max(120),
  address: z.string().trim().min(1, "Die Adresse ist erforderlich").max(250),
  city: z.string().trim().min(1, "Die Stadt ist erforderlich").max(120),
  postalCode: z
    .string()
    .trim()
    .min(1, "Die Postleitzahl ist erforderlich")
    .regex(/^\d{5}$/, "Die Postleitzahl muss 5 Stellen haben"),
  phone: z
    .string()
    .trim()
    .min(1, "Die Telefonnummer ist erforderlich")
    .refine(isDePhone, DE_PHONE_HINT)
    .transform(normalizeDePhone),
  additionalInfo: z.string().trim().max(500).default(""),
  floor: z.coerce.number().int().min(0).max(10).default(0),
  isDefault: z.boolean().optional().default(false),
});

export type AddressInput = z.infer<typeof addressSchema>;

export const passwordSchema = z
  .string()
  .min(8, "Das Passwort muss mindestens 8 Zeichen enthalten")
  .max(128, "Passwort zu lang")
  .regex(/[A-Za-z]/, "Das Passwort muss mindestens einen Buchstaben enthalten")
  .regex(/[0-9]/, "Das Passwort muss mindestens eine Ziffer enthalten");

export const emailSchema = z.string().trim().toLowerCase().email("Ungültige E-Mail-Adresse").max(254);
