import { json, requireUser, route } from "@/lib/server/api";
import { listUserOrders, toOrderDTO } from "@/lib/server/orders";

/** GET /api/orders — historique des commandes du client connecté. */
export const GET = route("GET /api/orders", async () => {
  const user = await requireUser();
  return json({ orders: (await listUserOrders(user.id)).map(toOrderDTO) });
});
