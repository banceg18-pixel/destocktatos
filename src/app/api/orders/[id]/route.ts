import { json, requireUser, route } from "@/lib/server/api";
import { getUserOrder, toOrderDTO } from "@/lib/server/orders";
import { objectId } from "@/lib/validation";

/** GET /api/orders/:id — détail d'une commande (uniquement celles du client connecté). */
export const GET = route("GET /api/orders/:id", async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  return json(toOrderDTO(await getUserOrder(user.id, objectId.parse((await ctx.params).id))));
});
