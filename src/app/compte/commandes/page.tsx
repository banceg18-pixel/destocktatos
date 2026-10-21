import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { OrderActions } from "@/components/account/OrderActions";
import { TransferDetails } from "@/components/checkout/TransferDetails";
import { ButtonLink } from "@/components/ui/Button";
import { ImageComponent } from "@/components/ui/ImageComponent";
import { Arrow } from "@/components/ui/Primitives";
import { getSession } from "@/lib/auth";
import { bankDetailsOf } from "@/lib/bank";
import { getSiteSettings } from "@/lib/cms";
import { formatEuros } from "@/lib/money";
import { displayTitle } from "@/lib/text";
import { listUserOrders, toOrderDTO } from "@/lib/server/orders";
import { DELIVERY_LABELS, ORDER_STATUS_LABELS, orderStatusLabel } from "@/services/orders";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mes commandes", robots: { index: false, follow: false } };

export default async function CommandesPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/connexion?callbackUrl=/compte/commandes");
  const [orders, bank] = await Promise.all([listUserOrders(session.user.id).then((list) => list.map(toOrderDTO)), getSiteSettings().then(bankDetailsOf, () => null)]);

  return (
    <div>
      <h1 className="t-h2">Mes commandes</h1>

      {orders.length === 0 ? (
        <div className="mt-12 flex flex-col items-start gap-5 border border-dashed border-line p-8">
          <p className="text-graphite">Vous n&apos;avez pas encore passé de commande.</p>
          <ButtonLink href="/boutique" variant="outline" icon={<Arrow />}>
            Découvrir la boutique
          </ButtonLink>
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-6 sm:mt-12 sm:gap-8">
          {orders.map((o) => (
            <article key={o._id} className="border border-line">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-mist/60 px-4 py-4 sm:px-5">
                <div>
                  <h2 className="t-spec !text-sm text-ink">Commande {o.number}</h2>
                  <p className="mt-1 text-sm text-graphite">
                    Passée le {new Date(o.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                    {o.paidAt
                      ? ` · payée le ${new Date(o.paidAt).toLocaleDateString("fr-FR")}`
                      : o.status === "EN_ATTENTE_VIREMENT"
                        ? " · à régler par virement"
                        : o.paymentProvider === "sur_place" && o.status !== "ANNULEE" && o.status !== "EN_ATTENTE_PAIEMENT"
                        ? ` · à régler ${o.isPickupInStore ? "au retrait" : "à la livraison"}`
                        : ""}
                  </p>
                </div>
                <span className={`t-eyebrow rounded-full px-3 py-1.5 !text-[0.65rem] ${ORDER_STATUS_LABELS[o.status].className}`}>{orderStatusLabel(o.status, o.isPickupInStore)}</span>
              </header>
              <div className="grid gap-6 p-4 sm:gap-8 sm:p-5 md:grid-cols-[1.6fr_1fr]">
                <ul className="flex flex-col gap-4">
                  {o.items.map((it) => {
                    const title = displayTitle(it.title, it.marque);
                    return (
                      <li key={it.productId} className="flex items-center gap-3 sm:gap-4">
                        <div className="size-14 shrink-0 bg-mist p-1.5 sm:size-16">
                          <ImageComponent img={it.imagePrincipale.url} alt="" size={64} className="size-full object-contain mix-blend-multiply" />
                        </div>
                        <div className="min-w-0 flex-1 text-sm">
                          {it.slug ? (
                            <Link href={`/boutique/${it.slug}`} className="line-clamp-2 font-medium hover:underline">
                              {title}
                            </Link>
                          ) : (
                            <span className="line-clamp-2 font-medium">{title}</span>
                          )}
                          <p className="t-spec mt-1 text-graphite">
                            {it.marque} · {it.quantity} × {formatEuros(it.price)}
                          </p>
                        </div>
                        <span className="t-price shrink-0 text-sm">{formatEuros(it.price * it.quantity)}</span>
                      </li>
                    );
                  })}
                </ul>
                <div className="text-sm">
                  <p className="font-medium">{o.isPickupInStore ? "Retrait en magasin" : (DELIVERY_LABELS[o.deliveryMethod ?? ""] ?? "Livraison")}</p>
                  {o.shippingAddress && (
                    <p className="mt-1 text-graphite">
                      {o.shippingAddress.fullName}, {o.shippingAddress.address}, {o.shippingAddress.postalCode} {o.shippingAddress.city}
                    </p>
                  )}
                  <dl className="t-price mt-4 flex flex-col gap-1.5 border-t border-line pt-4">
                    <div className="flex justify-between">
                      <dt className="text-graphite">Articles</dt>
                      <dd>{formatEuros(o.subtotal)}</dd>
                    </div>
                    {o.appliedCoupon && (
                      <div className="flex justify-between text-success">
                        <dt>Réduction {o.appliedCoupon.code}</dt>
                        <dd>−{formatEuros(o.appliedCoupon.discount)}</dd>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <dt className="text-graphite">{o.isPickupInStore ? "Retrait" : "Livraison"}</dt>
                      <dd>{o.isPickupInStore ? "Gratuit" : formatEuros(o.deliveryFee)}</dd>
                    </div>
                    <div className="flex justify-between border-t border-line pt-2 font-medium">
                      <dt>Total TTC</dt>
                      <dd>{formatEuros(o.totalAmount)}</dd>
                    </div>
                  </dl>
                </div>
              </div>
              {o.status === "EN_ATTENTE_VIREMENT" &&
                (o.transferDeclaredAt ? (
                  <p className="mx-4 mb-5 border border-line p-4 text-sm text-graphite sm:mx-5">
                    Virement signalé le {new Date(o.transferDeclaredAt).toLocaleDateString("fr-FR")} : nous vérifions sa réception. La facture vous sera envoyée par email dès
                    qu&apos;il est reçu.
                  </p>
                ) : (
                  <TransferDetails amount={o.totalAmount} reference={o.number} bank={bank} className="mx-4 mb-5 sm:mx-5" />
                ))}
              <footer className="border-t border-line px-4 py-4 sm:px-5">
                <OrderActions orderId={o._id} status={o.status} paid={!!o.paidAt} />
              </footer>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
