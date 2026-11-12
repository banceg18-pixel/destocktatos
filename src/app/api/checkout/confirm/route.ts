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
  if (provider.name !== "stripe") throw new ApiError(400, "Kein Online-Zahlungsanbieter konfiguriert");
  const pi = await provider.retrieve(paymentIntentId);
  if (!pi.orderId) throw new ApiError(400, "Zahlung keiner Bestellung zugeordnet");
  const order = await prisma.order.findUnique({ where: { id: pi.orderId } });
  if (!order || order.userId !== user.id) throw new ApiError(404, "Bestellung nicht gefunden");
  if (pi.amountCents !== order.totalCents) throw new ApiError(409, "Der gezahlte Betrag stimmt nicht mit der Bestellung überein");
  if (billingAddress) await prisma.order.update({ where: { id: order.id }, data: { billingAddress } });
  if (pi.status === "succeeded") {
    const paid = await markOrderPaid(order.id, { provider: "stripe", mode: provider.mode, providerRef: paymentIntentId });
    return json({ status: "succeeded", orderId: paid.id, number: paid.number });
  }
  if (pi.status === "failed" || pi.status === "canceled") {
    await recordPaymentFailure(order.id, { provider: "stripe", mode: provider.mode, providerRef: paymentIntentId, reason: pi.status });
    throw new ApiError(402, "Die Zahlung wurde abgelehnt. Sie können es mit einer anderen Zahlungsmethode erneut versuchen.");
  }
  return json({ status: pi.status, orderId: order.id, number: order.number });
});
