import { z } from "zod";
import { json, limitByIp, parseBody, route } from "@/lib/server/api";
import { validateAddress } from "@/lib/server/ban";

const schema = z.object({
  address: z.string().trim().min(1).max(250),
  postalCode: z.string().trim().regex(/^\d{5}$/, "Le code postal doit contenir 5 chiffres"),
  city: z.string().trim().min(1).max(120),
});

/** POST /api/addresses/validate — vérifie l'adresse et renvoie sa forme normalisée. */
export const POST = route("POST /api/addresses/validate", async (req: Request) => {
  limitByIp(req, "address-validate", 60, 60 * 1000);
  const b = await parseBody(req, schema);
  try {
    return json(await validateAddress(b.address, b.postalCode, b.city));
  } catch (e) {
    console.warn("[addresses] validation BAN indisponible:", (e as Error).message);
    // Service externe indisponible : on n'empêche pas l'enregistrement (validation format déjà faite).
    return json({ valid: true, normalizedAddress: b, unverified: true });
  }
});
