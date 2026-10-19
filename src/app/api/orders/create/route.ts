import { json, limitByIp, parseBody, requireUser, route } from "@/lib/server/api";
import { createOrder, toOrderDTO } from "@/lib/server/orders";
import { createOrderSchema } from "@/lib/server/order-schemas";

/**
 * POST /api/orders/create — crée la commande à partir du panier.
 * Prix, stock, coupon, distance et frais de livraison sont recalculés côté serveur ;
 * le stock est réservé (30 min) jusqu'au paiement.
 */
export const POST = route("POST /api/orders/create", async (req: Request) => {
  limitByIp(req, "order-create", 20);
  const user = await requireUser();
  const b = await parseBody(req, createOrderSchema);
  const { order } = await createOrder(user.id, {
    items: b.items,
    totalAmount: b.totalAmount,
    deliveryMethod: b.isPickupInStore ? null : (b.deliveryMethod ?? null),
    includeOldItemPickup: !!b.includeOldItemPickup,
    isPickupInStore: b.isPickupInStore,
    shippingAddress: b.isPickupInStore ? null : (b.shippingAddress ?? null),
    couponCode: b.appliedCoupon?.code || null,
  });
  return json({ success: true, order: toOrderDTO(order) }, 201);
});
