import { json, requireUser, route } from "@/lib/server/api";
import { cancelPendingOrder } from "@/lib/server/orders";
import { objectId } from "@/lib/validation";

/** POST /api/orders/:id/cancel — abandon d'une commande non payée (stock libéré). */
export const POST = route("POST /api/orders/:id/cancel", async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  await cancelPendingOrder(user.id, objectId.parse((await ctx.params).id));
  return json({ success: true, message: "Commande annulée" });
});
