import { json, parseBody, requireUser, route } from "@/lib/server/api";
import { createAddress, listAddresses } from "@/lib/server/addresses";
import { addressSchema } from "@/lib/validation";

/** GET /api/user/addresses — adresses du client connecté. */
export const GET = route("GET /api/user/addresses", async () => {
  const user = await requireUser();
  return json({ addresses: await listAddresses(user.id) });
});

/** POST /api/user/addresses — nouvelle adresse (la première devient l'adresse par défaut). */
export const POST = route("POST /api/user/addresses", async (req: Request) => {
  const user = await requireUser();
  const input = await parseBody(req, addressSchema);
  const address = await createAddress(user.id, input);
  return json({ address, message: "Adresse sauvegardée avec succès" }, 201);
});
