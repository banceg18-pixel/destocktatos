import { json, requireUser, route } from "@/lib/server/api";
import { setDefaultAddress } from "@/lib/server/addresses";
import { objectId } from "@/lib/validation";

/** PUT /api/user/addresses/:id/default — définit l'adresse par défaut (une seule par client). */
export const PUT = route("PUT /api/user/addresses/:id/default", async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  await setDefaultAddress(user.id, objectId.parse((await ctx.params).id));
  return json({ message: "Adresse définie par défaut" });
});
