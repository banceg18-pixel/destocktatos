import { json, parseBody, requireUser, route, limitByIp } from "@/lib/server/api";
import { createReview, listReviews } from "@/lib/server/reviews";
import { objectId, reviewSchema } from "@/lib/validation";

/** GET /api/avis?produit=ID — avis d'un produit (tableau, format source). */
export const GET = route("GET /api/avis", async (req: Request) => {
  const produit = objectId.parse(new URL(req.url).searchParams.get("produit") ?? "");
  return json(await listReviews(produit));
});

/** POST /api/avis — publier un avis (client connecté ayant acheté le produit). */
export const POST = route("POST /api/avis", async (req: Request) => {
  limitByIp(req, "avis", 20);
  const user = await requireUser();
  const body = await parseBody(req, reviewSchema);
  return json(await createReview(user.id, body.produit, body.note, body.commentaire), 201);
});
