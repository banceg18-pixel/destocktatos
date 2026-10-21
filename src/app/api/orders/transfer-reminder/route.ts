import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { bankDetailsOf } from "@/lib/bank";
import { getSiteSettings } from "@/lib/cms";
import { toEuros } from "@/lib/money";
import { json, route } from "@/lib/server/api";
import { getBuyerOrder, guestOrderId } from "@/lib/server/buyer";
import { sendMail, STORE_EMAIL } from "@/lib/server/mailer";

/**
 * GET /api/orders/transfer-reminder — commandes de l'acheteur dont le virement est attendu (compte
 * connecté, ou commande passée sans compte depuis ce navigateur), avec les informations de paiement :
 * alimente la fenêtre de paiement, qui reste affichée tant que le paiement n'est pas reçu.
 * `?order=<id>` : statut de cette commande (suivi du paiement par la fenêtre).
 */
export const GET = route("GET /api/orders/transfer-reminder", async (req: Request) => {
  const headers = { "Cache-Control": "private, no-store" };
  const orderId = new URL(req.url).searchParams.get("order");
  if (orderId && /^[A-Za-z0-9_-]{1,64}$/.test(orderId)) {
    try {
      const o = await getBuyerOrder(orderId);
      return json({ status: o.status, paid: !!o.paidAt }, { headers });
    } catch {
      return json({ status: null, paid: false }, { headers });
    }
  }
  const [session, guestId] = await Promise.all([getSession(), guestOrderId()]);
  const who = [...(session?.user?.id ? [{ userId: session.user.id }] : []), ...(guestId ? [{ id: guestId }] : [])];
  if (!who.length) return json({ orders: [], bank: null }, { headers });
  const rows = await prisma.order.findMany({
    where: { status: "EN_ATTENTE_VIREMENT", OR: who },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, number: true, totalCents: true, payments: { select: { details: true } } },
  });
  // Virement déjà signalé par le client : le magasin vérifie sa réception, plus de fenêtre.
  const orders = rows.filter((o) => !o.payments.some((p) => (p.details as { declaredAt?: string } | null)?.declaredAt));
  if (!orders.length) return json({ orders: [], bank: null }, { headers });
  const s = await getSiteSettings();
  return json(
    { orders: orders.map((o) => ({ id: o.id, number: o.number, amount: toEuros(o.totalCents) })), bank: bankDetailsOf(s), contact: { email: s.email, phone: s.phone } },
    { headers },
  );
});

/**
 * POST /api/orders/transfer-reminder { orderId } — le client confirme avoir effectué son virement :
 * c'est noté sur la commande et le magasin est prévenu pour vérifier la réception (la commande reste
 * « En attente de virement » jusqu'à ce qu'il la passe à « Payée »).
 */
export const POST = route("POST /api/orders/transfer-reminder", async (req: Request) => {
  const { orderId } = (await req.json().catch(() => ({}))) as { orderId?: string };
  if (!orderId || !/^[A-Za-z0-9_-]{1,64}$/.test(orderId)) return json({ ok: false }, 400);
  const o = await getBuyerOrder(orderId);
  if (o.status !== "EN_ATTENTE_VIREMENT") return json({ ok: true, status: o.status });
  const declaredAt = new Date().toISOString();
  await prisma.payment.updateMany({ where: { orderId: o.id, provider: "virement", status: "EN_ATTENTE" }, data: { details: { declaredAt } } });
  const user = await prisma.user.findUnique({ where: { id: o.userId }, select: { name: true, email: true } });
  await sendMail({
    to: STORE_EMAIL,
    replyTo: user?.email,
    tag: "virement-signale",
    subject: `Virement signalé — commande ${o.number} — ${toEuros(o.totalCents).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}`,
    text: `Le client ${user?.name ?? ""} <${user?.email ?? ""}> indique avoir effectué le virement de la commande ${o.number}.

Vérifiez sa réception sur le compte bancaire, puis passez la commande à « Payée (virement reçu) » dans WordPress → Boutique → Commandes : le client reçoit alors sa facture.`,
  });
  return json({ ok: true, status: o.status, declaredAt });
});
