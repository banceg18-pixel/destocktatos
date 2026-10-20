import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { bankDetailsOf } from "@/lib/bank";
import { getSiteSettings } from "@/lib/cms";
import { toEuros } from "@/lib/money";
import { json, route } from "@/lib/server/api";
import { guestOrderId } from "@/lib/server/buyer";

/**
 * GET /api/orders/transfer-reminder — commandes de l'acheteur dont le virement est attendu (compte
 * connecté, ou commande passée sans compte depuis ce navigateur), avec les coordonnées bancaires :
 * alimente le rappel affiché quand le client revient sur le site.
 */
export const GET = route("GET /api/orders/transfer-reminder", async () => {
  const headers = { "Cache-Control": "private, no-store" };
  const [session, guestId] = await Promise.all([getSession(), guestOrderId()]);
  const who = [...(session?.user?.id ? [{ userId: session.user.id }] : []), ...(guestId ? [{ id: guestId }] : [])];
  if (!who.length) return json({ orders: [], bank: null }, { headers });
  const orders = await prisma.order.findMany({
    where: { status: "EN_ATTENTE_VIREMENT", OR: who },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { id: true, number: true, totalCents: true },
  });
  if (!orders.length) return json({ orders: [], bank: null }, { headers });
  return json({ orders: orders.map((o) => ({ id: o.id, number: o.number, amount: toEuros(o.totalCents) })), bank: bankDetailsOf(await getSiteSettings()) }, { headers });
});
