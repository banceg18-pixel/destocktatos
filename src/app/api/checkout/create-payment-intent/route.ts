import { prisma } from "@/lib/prisma";
import { ApiError, json, requireUser, route } from "@/lib/server/api";
import { getLatestPendingOrder } from "@/lib/server/orders";
import { getPaymentProvider, isPayOnDeliveryEnabled } from "@/lib/server/payments";

/**
 * POST /api/checkout/create-payment-intent — prépare le paiement de la commande en attente.
 * Le montant provient exclusivement de la commande enregistrée (le corps de requête est ignoré).
 * `payOnDelivery` indique si le règlement à la livraison ou au retrait est proposé.
 */
export const POST = route("POST /api/checkout/create-payment-intent", async () => {
  const user = await requireUser();
  const order = await getLatestPendingOrder(user.id);
  if (!order) throw new ApiError(404, "Aucune commande en attente de paiement");
  const provider = getPaymentProvider();
  const { clientSecret, providerRef } = await provider.createIntent(order, user.email);
  await prisma.payment.upsert({
    where: { id: `${order.id}-${providerRef}`.slice(0, 190) },
    update: {},
    create: {
      id: `${order.id}-${providerRef}`.slice(0, 190),
      orderId: order.id,
      provider: provider.name,
      mode: provider.mode,
      providerRef,
      amountCents: order.totalCents,
      status: "EN_ATTENTE",
    },
  });
  return json({ clientSecret, provider: provider.name, mode: provider.mode, payOnDelivery: isPayOnDeliveryEnabled(), orderId: order.id, amount: order.totalCents / 100 });
});
