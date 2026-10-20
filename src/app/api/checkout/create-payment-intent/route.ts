import { prisma } from "@/lib/prisma";
import { ApiError, json, route } from "@/lib/server/api";
import { requireBuyer } from "@/lib/server/buyer";
import { expireStaleOrders, getLatestPendingOrder } from "@/lib/server/orders";
import { getPaymentProvider, isBankTransferEnabled } from "@/lib/server/payments";

/**
 * POST /api/checkout/create-payment-intent — prépare le paiement de la commande en attente.
 * Le montant provient exclusivement de la commande enregistrée (le corps de requête est ignoré).
 * `bankTransfer` indique si le règlement par virement bancaire (avant livraison) est proposé.
 */
export const POST = route("POST /api/checkout/create-payment-intent", async () => {
  const buyer = await requireBuyer();
  if (buyer.guestOrderId) await expireStaleOrders();
  const order = buyer.userId
    ? await getLatestPendingOrder(buyer.userId)
    : await prisma.order.findFirst({ where: { id: buyer.guestOrderId!, status: "EN_ATTENTE_PAIEMENT" }, include: { user: { select: { email: true } } } });
  if (!order) throw new ApiError(404, "Aucune commande en attente de paiement");
  const provider = getPaymentProvider();
  const { clientSecret, providerRef } = await provider.createIntent(order, buyer.email ?? ("user" in order ? order.user.email : null));
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
  return json({ clientSecret, provider: provider.name, mode: provider.mode, bankTransfer: isBankTransferEnabled(), orderId: order.id, amount: order.totalCents / 100 });
});
