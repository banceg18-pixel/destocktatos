import { prisma } from "@/lib/prisma";
import { ApiError, json, route } from "@/lib/server/api";
import { requireBuyer } from "@/lib/server/buyer";
import { expireStaleOrders, getLatestPendingOrder, toOrderDTO } from "@/lib/server/orders";

/**
 * GET /api/orders/latest — commande en attente de règlement de l'acheteur (compte connecté, ou invité
 * pour la commande qu'il vient de passer) ; 404 si aucune. `customerEmail` pré-remplit la facturation.
 */
export const GET = route("GET /api/orders/latest", async () => {
  const buyer = await requireBuyer();
  if (buyer.guestOrderId) await expireStaleOrders();
  const order = buyer.userId
    ? await getLatestPendingOrder(buyer.userId)
    : await prisma.order.findFirst({
        where: { id: buyer.guestOrderId!, status: "EN_ATTENTE_PAIEMENT" },
        include: { items: { include: { product: { select: { prixCents: true, slug: true } } } }, user: { select: { email: true } } },
      });
  if (!order) throw new ApiError(404, "Aucune commande en cours");
  const customerEmail = buyer.email ?? ("user" in order ? (order.user as { email: string }).email : null);
  return json({ ...toOrderDTO(order), customerEmail });
});
