import { json, parseBody, requireUser, route } from "@/lib/server/api";
import { deleteReview, updateReview } from "@/lib/server/reviews";
import { objectId, reviewUpdateSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

/** PUT /api/avis/:id — modifier son avis. */
export const PUT = route("PUT /api/avis/:id", async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const id = objectId.parse((await ctx.params).id);
  const body = await parseBody(req, reviewUpdateSchema);
  return json(await updateReview(user.id, id, body.note, body.commentaire));
});

/** DELETE /api/avis/:id — supprimer son avis. */
export const DELETE = route("DELETE /api/avis/:id", async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const id = objectId.parse((await ctx.params).id);
  await deleteReview(user.id, id);
  return json({ success: true });
});
