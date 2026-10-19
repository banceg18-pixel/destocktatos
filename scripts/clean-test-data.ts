/**
 * Supprime les données créées par les recettes et tests automatisés (comptes en @tatos.test,
 * leurs commandes, avis, adresses, messages, abonnements) et remet en stock les articles de leurs
 * commandes encore actives. Les comptes de démonstration du seed sont conservés.
 *
 *   npx tsx scripts/clean-test-data.ts            # nettoie la base de DATABASE_URL (.env)
 *   npx tsx scripts/clean-test-data.ts --dry-run  # affiche seulement ce qui serait supprimé
 */
import { PrismaClient } from "@prisma/client";

const DOMAIN = "@tatos.test";
const KEEP = [/^client\.demo@/, /^avis-importe/];
const dryRun = process.argv.includes("--dry-run");
const prisma = new PrismaClient();

const isTestEmail = (email: string) => email.toLowerCase().endsWith(DOMAIN) && !KEEP.some((re) => re.test(email));

async function main() {
  const users = (await prisma.user.findMany({ where: { email: { endsWith: DOMAIN } }, select: { id: true, email: true } })).filter((u) => isTestEmail(u.email));
  const userIds = users.map((u) => u.id);
  const orders = await prisma.order.findMany({ where: { userId: { in: userIds } }, include: { items: true } });
  const emailFilter = { email: { endsWith: DOMAIN } };
  const [contacts, services, tickets, subscribers] = await Promise.all([
    prisma.contactMessage.findMany({ where: emailFilter, select: { id: true, email: true } }),
    prisma.serviceRequest.findMany({ where: emailFilter, select: { id: true, email: true } }),
    prisma.ticket.findMany({ where: { OR: [emailFilter, { userId: { in: userIds } }] }, select: { id: true, email: true } }),
    prisma.newsletterSubscriber.findMany({ where: emailFilter, select: { id: true, email: true } }),
  ]);
  const pick = <T extends { email: string }>(rows: T[]) => rows.filter((r) => isTestEmail(r.email));

  console.log(`Comptes de test : ${users.length} · commandes : ${orders.length}`);
  console.log(`Messages : ${pick(contacts).length} contact, ${pick(services).length} rendez-vous, ${tickets.length} signalements · abonnés : ${pick(subscribers).length}`);
  if (dryRun) {
    users.forEach((u) => console.log("  -", u.email));
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const o of orders) {
      // Une commande active réserve du stock : il est rendu avant suppression.
      if (o.status !== "ANNULEE") {
        for (const it of o.items) await tx.product.updateMany({ where: { id: it.productId }, data: { stock: { increment: it.quantity } } });
      }
    }
    const orderIds = orders.map((o) => o.id);
    const redemptions = await tx.couponRedemption.findMany({ where: { OR: [{ orderId: { in: orderIds } }, { userId: { in: userIds } }] } });
    for (const r of redemptions) await tx.coupon.update({ where: { id: r.couponId }, data: { usedCount: { decrement: 1 } } });
    await tx.couponRedemption.deleteMany({ where: { id: { in: redemptions.map((r) => r.id) } } });
    await tx.order.deleteMany({ where: { id: { in: orderIds } } });
    await tx.ticket.deleteMany({ where: { id: { in: tickets.map((t) => t.id) } } });
    await tx.coupon.deleteMany({ where: { userId: { in: userIds } } });
    await tx.user.deleteMany({ where: { id: { in: userIds } } });
    await tx.contactMessage.deleteMany({ where: { id: { in: pick(contacts).map((m) => m.id) } } });
    await tx.serviceRequest.deleteMany({ where: { id: { in: pick(services).map((m) => m.id) } } });
    await tx.newsletterSubscriber.deleteMany({ where: { id: { in: pick(subscribers).map((s) => s.id) } } });
  });
  console.log("Données de test supprimées.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
