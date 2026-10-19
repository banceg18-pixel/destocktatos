import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError, json, parseBody, requireUser, route } from "@/lib/server/api";
import { confirmPayOnDelivery, getUserOrder } from "@/lib/server/orders";
import { billingSchema } from "@/lib/server/order-schemas";
import { isPayOnDeliveryEnabled } from "@/lib/server/payments";
import { objectId } from "@/lib/validation";

const schema = z.object({ orderId: objectId, billingAddress: billingSchema });

/**
 * POST /api/checkout/pay-on-delivery — confirme la commande en attente avec un règlement à la
 * livraison (ou au retrait en magasin). Aucun paiement en ligne : la commande passe en préparation.
 */
export const POST = route("POST /api/checkout/pay-on-delivery", async (req: Request) => {
  if (!isPayOnDeliveryEnabled()) throw new ApiError(403, "Le paiement à la livraison n'est pas proposé : réglez votre commande par carte.");
  const user = await requireUser();
  const { orderId, billingAddress } = await parseBody(req, schema);
  const order = await getUserOrder(user.id, orderId);
  if (order.status === "ANNULEE") throw new ApiError(409, "La réservation de vos articles a expiré : revenez au panier pour relancer la commande.");
  if (order.status !== "EN_ATTENTE_PAIEMENT") throw new ApiError(409, "Cette commande est déjà confirmée.");
  await prisma.order.update({ where: { id: order.id }, data: { billingAddress } });
  const confirmed = await confirmPayOnDelivery(order.id);
  return json({ status: "confirmed", orderId: confirmed.id, number: confirmed.number });
});
