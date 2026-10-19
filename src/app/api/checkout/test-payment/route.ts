import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError, json, parseBody, requireUser, route } from "@/lib/server/api";
import { getUserOrder, markOrderPaid, recordPaymentFailure } from "@/lib/server/orders";
import { billingSchema } from "@/lib/server/order-schemas";
import { isTestPaymentEnabled } from "@/lib/server/payments";
import { objectId } from "@/lib/validation";

const schema = z.object({ orderId: objectId, outcome: z.enum(["success", "failure"]), billingAddress: billingSchema });

/**
 * POST /api/checkout/test-payment — simulation réservée aux tests automatisés (TEST_PAYMENTS=true,
 * sans clé Stripe). Introuvable (404) partout ailleurs. La commande est marquée paymentMode = "test".
 */
export const POST = route("POST /api/checkout/test-payment", async (req: Request) => {
  if (!isTestPaymentEnabled()) throw new ApiError(404, "Ressource introuvable");
  const user = await requireUser();
  const { orderId, outcome, billingAddress } = await parseBody(req, schema);
  const order = await getUserOrder(user.id, orderId);
  if (order.status !== "EN_ATTENTE_PAIEMENT") throw new ApiError(409, "Cette commande n'est plus en attente de paiement");
  await prisma.order.update({ where: { id: order.id }, data: { billingAddress } });
  const ref = `test_${crypto.randomUUID()}`;
  if (outcome === "failure") {
    await recordPaymentFailure(order.id, { provider: "test", mode: "test", providerRef: ref, reason: "simulation_refus" });
    throw new ApiError(402, "Paiement refusé. Aucun montant n'a été débité.");
  }
  const paid = await markOrderPaid(order.id, { provider: "test", mode: "test", providerRef: ref, details: { simulated: true } });
  return json({ status: "succeeded", orderId: paid.id, number: paid.number, paymentId: ref, mode: "test" });
});
