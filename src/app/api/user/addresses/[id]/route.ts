import { json, parseBody, requireUser, route } from "@/lib/server/api";
import { deleteAddress, getAddress, updateAddress } from "@/lib/server/addresses";
import { addressSchema, objectId } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route("GET /api/user/addresses/:id", async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  return json({ address: await getAddress(user.id, objectId.parse((await ctx.params).id)) });
});

export const PUT = route("PUT /api/user/addresses/:id", async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const id = objectId.parse((await ctx.params).id);
  const input = await parseBody(req, addressSchema);
  return json({ address: await updateAddress(user.id, id, input), message: "Adresse modifiée avec succès" });
});

export const DELETE = route("DELETE /api/user/addresses/:id", async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  await deleteAddress(user.id, objectId.parse((await ctx.params).id));
  return json({ message: "Adresse supprimée avec succès" });
});
