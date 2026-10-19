import { z } from "zod";
import { PUBLIC_CACHE, json, route } from "@/lib/server/api";
import { getSuggestions } from "@/lib/catalog/repository";

const query = z.object({
  id: z.string().trim().min(1).max(64),
  categorie: z.string().trim().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(24).default(8),
});

/** GET /api/produits/suggestions?id=…&categorie=…&limit=8 — tableau de produits (format source). */
export const GET = route("GET /api/produits/suggestions", async (req: Request) => {
  const { id, categorie, limit } = query.parse(Object.fromEntries(new URL(req.url).searchParams));
  return json(await getSuggestions(id, categorie, limit), PUBLIC_CACHE);
});
