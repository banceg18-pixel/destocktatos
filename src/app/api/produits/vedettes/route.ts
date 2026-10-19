import { z } from "zod";
import { PUBLIC_CACHE, json, route } from "@/lib/server/api";
import { getFeaturedProducts } from "@/lib/catalog/repository";

/** GET /api/produits/vedettes?limit=N — produits mis en avant. */
export const GET = route("GET /api/produits/vedettes", async (req: Request) => {
  const limit = z.coerce.number().int().min(1).max(50).default(10).parse(new URL(req.url).searchParams.get("limit") ?? undefined);
  return json({ produits: await getFeaturedProducts(limit) }, PUBLIC_CACHE);
});
