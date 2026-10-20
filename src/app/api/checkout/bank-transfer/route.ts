import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError, json, parseBody, requireUser, route } from "@/lib/server/api";
import { confirmBankTransfer, getUserOrder } from "@/lib/server/orders";
import { billingSchema } from "@/lib/server/order-schemas";
import { isBankTransferEnabled } from "@/lib/server/payments";
import { objectId } from "@/lib/validation";

const schema = z.object({ orderId: objectId, billingAddress: billingSchema });

/**
 * POST /api/checkout/bank-transfer — confirme la commande en attente avec un règlement par virement
 * bancaire avant livraison. Aucun paiement en ligne : la commande attend le virement, ses articles
 * restent réservés et le client reçoit la facture avec les coordonnées bancaires.
 */
export const POST = route("POST /api/checkout/bank-transfer", async (req: Request) => {
  if (!isBankTransferEnabled()) throw new ApiError(403, "Le virement bancaire n'est pas proposé : réglez votre commande par carte.");
  const user = await requireUser();
  const { orderId, billingAddress } = await parseBody(req, schema);
  const order = await getUserOrder(user.id, orderId);
  if (order.status === "ANNULEE") throw new ApiError(409, "La réservation de vos articles a expiré : revenez au panier pour relancer la commande.");
  if (order.status !== "EN_ATTENTE_PAIEMENT") throw new ApiError(409, "Cette commande est déjà confirmée.");
  await prisma.order.update({ where: { id: order.id }, data: { billingAddress } });
  const confirmed = await confirmBankTransfer(order.id);
  return json({ status: "confirmed", orderId: confirmed.id, number: confirmed.number });
});
