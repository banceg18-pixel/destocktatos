import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ApiError, json, limitByIp, route } from "@/lib/server/api";
import { rememberGuestOrder } from "@/lib/server/buyer";
import { createOrder, toOrderDTO } from "@/lib/server/orders";
import { createOrderSchema } from "@/lib/server/order-schemas";
import { emailSchema } from "@/lib/validation";

const guestSchema = z.object({ guest: z.object({ email: emailSchema }).optional() });

/**
 * POST /api/orders/create — crée la commande à partir du panier, avec ou sans compte.
 * Sans compte (`guest.email`) : la commande est rattachée à l'adresse email (compte créé sans mot de
 * passe s'il n'existe pas) ; le visiteur choisira son mot de passe via le lien reçu par email pour
 * retrouver ses factures. Prix, stock, coupon, distance et frais de livraison sont recalculés côté
 * serveur ; le stock est réservé (30 min) jusqu'à la confirmation du règlement.
 */
export const POST = route("POST /api/orders/create", async (req: Request) => {
  limitByIp(req, "order-create", 20);
  const raw: unknown = await req.json().catch(() => {
    throw new ApiError(400, "Requête invalide.");
  });
  const b = createOrderSchema.parse(raw);
  const session = await getSession();
  let userId = session?.user?.id ?? null;
  const guest = !userId;
  if (!userId) {
    const email = guestSchema.parse(raw).guest?.email;
    if (!email) throw new ApiError(400, "Indiquez votre adresse email pour recevoir la confirmation et la facture.", { field: "email" });
    const name = b.shippingAddress?.fullName?.trim() || email.split("@")[0];
    const user = await prisma.user.upsert({ where: { email }, update: {}, create: { email, name } });
    userId = user.id;
  }
  const { order } = await createOrder(
    userId,
    {
      items: b.items,
      totalAmount: b.totalAmount,
      deliveryMethod: b.isPickupInStore ? null : (b.deliveryMethod ?? null),
      includeOldItemPickup: !!b.includeOldItemPickup,
      isPickupInStore: b.isPickupInStore,
      shippingAddress: b.isPickupInStore ? null : (b.shippingAddress ?? null),
      couponCode: b.appliedCoupon?.code || null,
    },
    undefined,
    // Invité : ne touche pas aux autres commandes en attente liées à cette adresse.
    { keepOtherPending: guest },
  );
  if (guest) await rememberGuestOrder(order.id);
  return json({ success: true, order: toOrderDTO(order) }, 201);
});
