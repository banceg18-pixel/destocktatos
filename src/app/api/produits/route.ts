import { z } from "zod";
import { PUBLIC_CACHE, json, route } from "@/lib/server/api";
import { listProducts, PRICE_MAX_DEFAULT } from "@/lib/catalog/repository";

const query = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  categorie: z.string().trim().max(100).optional(),
  sousCategorie: z.string().trim().max(100).optional(),
  prixMin: z.coerce.number().min(0).max(1_000_000).optional(),
  prixMax: z.coerce.number().min(0).max(1_000_000).optional(),
  recherche: z.string().trim().max(200).optional(),
  promotions: z.enum(["1", "true"]).optional(),
  tri: z.enum(["recent", "prix-asc", "prix-desc", "remise"]).optional(),
});

/** GET /api/produits — liste paginée (boutique) : en stock, plus récents d'abord, 12 par page. */
export const GET = route("GET /api/produits", async (req: Request) => {
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const q = query.parse(params);
  const result = await listProducts({
    page: q.page,
    limit: q.limit,
    categorie: q.categorie || undefined,
    sousCategorie: q.sousCategorie || undefined,
    prixMin: q.prixMin,
    prixMax: q.prixMax ?? PRICE_MAX_DEFAULT,
    recherche: q.recherche || undefined,
    promotions: !!q.promotions,
    tri: q.tri,
  });
  return json(result, PUBLIC_CACHE);
});
