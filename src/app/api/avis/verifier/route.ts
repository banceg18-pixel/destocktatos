import { json, route } from "@/lib/server/api";
import { getSession } from "@/lib/auth";
import { canUserReview } from "@/lib/server/reviews";
import { objectId } from "@/lib/validation";

/** GET /api/avis/verifier?produit=ID — l'utilisateur courant peut-il laisser un avis ? */
export const GET = route("GET /api/avis/verifier", async (req: Request) => {
  const produit = objectId.parse(new URL(req.url).searchParams.get("produit") ?? "");
  const session = await getSession();
  if (!session?.user?.id) return json({ peutCommenter: false, raison: "Non connecté" });
  const r = await canUserReview(session.user.id, produit);
  return json({ peutCommenter: r.ok, raison: r.raison });
});
