import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError, json, parseBody, requireUser, route } from "@/lib/server/api";
import { markOrderPaid, recordPaymentFailure } from "@/lib/server/orders";
import { billingSchema } from "@/lib/server/order-schemas";
import { getPaymentProvider } from "@/lib/server/payments";

const schema = z.object({ paymentIntentId: z.string().trim().min(3).max(120), billingAddress: billingSchema.partial().optional() });

/**
 * POST /api/checkout/confirm — après `stripe.confirmPayment`, vérifie le statut réel auprès de Stripe,
 * contrôle que le paiement correspond bien à la commande (propriétaire, montant) puis la marque payée.
 */
export const POST = route("POST /api/checkout/confirm", async (req: Request) => {
  const user = await requireUser();
  const { paymentIntentId, billingAddress } = await parseBody(req, schema);
  const provider = getPaymentProvider();
  if (provider.name !== "stripe") throw new ApiError(400, "Aucun fournisseur de paiement en ligne configuré");
  const pi = await provider.retrieve(paymentIntentId);
  if (!pi.orderId) throw new ApiError(400, "Paiement non associé à une commande");
  const order = await prisma.order.findUnique({ where: { id: pi.orderId } });
  if (!order || order.userId !== user.id) throw new ApiError(404, "Commande introuvable");
  if (pi.amountCents !== order.totalCents) throw new ApiError(409, "Le montant payé ne correspond pas à la commande");
  if (billingAddress) await prisma.order.update({ where: { id: order.id }, data: { billingAddress } });
  if (pi.status === "succeeded") {
    const paid = await markOrderPaid(order.id, { provider: "stripe", mode: provider.mode, providerRef: paymentIntentId });
    return json({ status: "succeeded", orderId: paid.id, number: paid.number });
  }
  if (pi.status === "failed" || pi.status === "canceled") {
    await recordPaymentFailure(order.id, { provider: "stripe", mode: provider.mode, providerRef: paymentIntentId, reason: pi.status });
    throw new ApiError(402, "Le paiement a été refusé. Vous pouvez réessayer avec un autre moyen de paiement.");
  }
  return json({ status: pi.status, orderId: order.id, number: order.number });
});
