import { ApiError, json, requireUser, route } from "@/lib/server/api";
import { getLatestPendingOrder, toOrderDTO } from "@/lib/server/orders";

/** GET /api/orders/latest — commande en attente de paiement du client (404 si aucune). */
export const GET = route("GET /api/orders/latest", async () => {
  const user = await requireUser();
  const order = await getLatestPendingOrder(user.id);
  if (!order) throw new ApiError(404, "Aucune commande en cours");
  return json(toOrderDTO(order));
});
