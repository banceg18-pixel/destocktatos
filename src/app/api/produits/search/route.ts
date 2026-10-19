import { z } from "zod";
import { PUBLIC_CACHE, json, route } from "@/lib/server/api";
import { searchProducts } from "@/lib/catalog/repository";

const query = z.object({
  q: z.string().trim().max(200).default(""),
  limit: z.coerce.number().int().min(1).max(50).default(5),
});

/** GET /api/produits/search?q=…&limit=5 — suggestions de la barre de recherche. */
export const GET = route("GET /api/produits/search", async (req: Request) => {
  const { q, limit } = query.parse(Object.fromEntries(new URL(req.url).searchParams));
  return json({ produits: await searchProducts(q, limit) }, PUBLIC_CACHE);
});
