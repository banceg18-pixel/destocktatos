import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AddressesSection } from "@/components/account/AddressesSection";
import { LogoutButton } from "@/components/account/LogoutButton";
import { ButtonLink } from "@/components/ui/Button";
import { Arrow } from "@/components/ui/Primitives";
import { getSession } from "@/lib/auth";
import { formatEuros } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { listAddresses } from "@/lib/server/addresses";
import { listUserOrders, toOrderDTO } from "@/lib/server/orders";
import { ORDER_STATUS_LABELS, orderStatusLabel } from "@/services/orders";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mon compte", robots: { index: false, follow: false } };

/** Tableau de bord client : commandes récentes, avantages fidélité, carnet d'adresses. */
export default async function ComptePage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/connexion?callbackUrl=/compte");
  const userId = session.user.id;
  const [user, addresses, orders, coupons] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true, createdAt: true } }),
    listAddresses(userId),
    listUserOrders(userId),
    prisma.coupon.findMany({ where: { userId, active: true }, orderBy: { createdAt: "desc" } }),
  ]);
  if (!user) redirect("/connexion");
  const recent = orders.slice(0, 3).map(toOrderDTO);
  const pending = orders.filter((o) => o.status === "EN_ATTENTE_PAIEMENT").length;
  const usableCoupons = coupons.filter((c) => (c.maxUses == null || c.usedCount < c.maxUses) && (!c.expiresAt || c.expiresAt > new Date()));

  return (
    <div className="flex flex-col gap-16">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          <h1 className="t-h2 [overflow-wrap:anywhere]">
            Bonjour,
            <br />
            {user.name}
          </h1>
          <p className="mt-4 text-graphite [overflow-wrap:anywhere]">
            {user.email} · client depuis {user.createdAt.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
          </p>
        </div>
        <LogoutButton className="lg:hidden" />
      </header>

      <dl className="grid grid-cols-3 border-y border-line">
        {[
          { label: "Commandes", value: String(orders.length) },
          { label: "À payer", value: String(pending) },
          { label: "Adresses", value: String(addresses.length) },
        ].map((s, i) => (
          <div key={s.label} className={i > 0 ? "min-w-0 border-l border-line px-3 py-5 sm:px-5 sm:py-6" : "min-w-0 py-5 pr-3 sm:py-6 sm:pr-5"}>
            <dt className="t-eyebrow truncate text-graphite">{s.label}</dt>
            <dd className="mt-2 font-display text-3xl font-medium tracking-tight [font-stretch:115%] sm:mt-3 sm:text-4xl">{s.value}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="commandes-recentes">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <h2 id="commandes-recentes" className="t-h3">
            Commandes récentes
          </h2>
          {orders.length > 0 && (
            <Link href="/compte/commandes" className="link-underline inline-flex items-center gap-2 text-sm">
              Toutes mes commandes ({orders.length}) <Arrow />
            </Link>
          )}
        </div>
        {recent.length === 0 ? (
          <div className="flex flex-col items-start gap-5 border border-dashed border-line p-8">
            <p className="text-graphite">Vous n&apos;avez pas encore passé de commande.</p>
            <ButtonLink href="/boutique" variant="outline" icon={<Arrow />}>
              Découvrir la boutique
            </ButtonLink>
          </div>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {recent.map((o) => (
              <li key={o._id}>
                <Link href="/compte/commandes" className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-5 transition-colors hover:bg-mist/60">
                  <div>
                    <p className="t-spec">{o.number}</p>
                    <p className="mt-1 text-sm text-graphite">
                      {new Date(o.createdAt).toLocaleDateString("fr-FR")} · {o.items.reduce((s, i) => s + i.quantity, 0)} article(s) · {formatEuros(o.totalAmount)}
                    </p>
                  </div>
                  <span className={`t-eyebrow rounded-full px-3 py-1.5 !text-[0.65rem] ${ORDER_STATUS_LABELS[o.status].className}`}>{orderStatusLabel(o.status, o.isPickupInStore)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="fidelite">
        <h2 id="fidelite" className="t-h3 mb-6">
          Avantages fidélité
        </h2>
        {usableCoupons.length === 0 ? (
          <p className="text-graphite">Aucun code de réduction disponible pour le moment.</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {usableCoupons.map((c) => (
              <li key={c.id} className="flex flex-col gap-2 bg-mist p-5">
                <p className="t-spec text-lg !tracking-[0.12em]">{c.code}</p>
                <p className="text-sm">{c.description}</p>
                <p className="text-xs text-graphite">
                  {c.type === "POURCENTAGE" ? `${c.value} %` : formatEuros(c.value / 100)} de réduction, dans la limite de 10 % de la commande
                  {c.expiresAt ? `, jusqu'au ${c.expiresAt.toLocaleDateString("fr-FR")}` : ""}.
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AddressesSection initialAddresses={addresses} />
    </div>
  );
}
