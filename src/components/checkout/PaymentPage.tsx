"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/client/cn";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
// Entrée « pure » : Stripe.js n'est chargé qu'à l'appel de loadStripe (aucune requête sans clé configurée).
import { loadStripe } from "@stripe/stripe-js/pure";
import { AddressElement, Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import type { SiteSettings } from "@/lib/cms/types";
import { useCart } from "@/context/CartProvider";
import { confirmBankTransfer, confirmStripePayment, createPaymentIntent, DELIVERY_LABELS, fetchLatestOrder, type OrderDTO } from "@/services/orders";
import { trackAddPaymentInfo, trackPaymentError, trackPurchase } from "@/lib/client/analytics";
import { formatEuros } from "@/lib/money";
import { displayTitle } from "@/lib/text";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ImageComponent } from "@/components/ui/ImageComponent";
import { Arrow, Field, Input, Spinner } from "@/components/ui/Primitives";
import { rules } from "@/lib/client/form-rules";
import { useFieldErrors } from "@/lib/client/use-field-errors";
import { IconAlert, IconClock, IconLock } from "@/components/ui/Icons";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

function Feedback({ text, kind = "error" }: { text: string; kind?: "error" | "info" }) {
  return (
    <div role={kind === "error" ? "alert" : "status"} className={kind === "error" ? "flex gap-3 border border-danger/30 bg-danger/5 p-4 text-sm" : "flex gap-3 bg-mist p-4 text-sm"}>
      <IconAlert className={kind === "error" ? "mt-0.5 shrink-0 text-danger" : "mt-0.5 shrink-0"} />
      <p>{text}</p>
    </div>
  );
}

function StripeForm({ order }: { order: OrderDTO }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const { clearCart } = useCart();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; kind: "error" | "info" } | null>(null);
  const [email, setEmail] = useState(session?.user?.email ?? "");
  const ef = useFieldErrors<"email">();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    if (!ef.validateAll({ email }, { email: rules.email })) return;
    setLoading(true);
    setFeedback(null);
    try {
      trackAddPaymentInfo({ payment_type: "card", value: order.totalAmount, coupon: order.appliedCoupon?.code });
      const address = await elements.getElement("address")?.getValue();
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: `${window.location.origin}/confirmation`, receipt_email: email },
        redirect: "if_required",
      });
      if (error) {
        setFeedback({ text: error.message || "Le paiement a été refusé. Vérifiez vos informations ou utilisez une autre carte.", kind: "error" });
        trackPaymentError(error.message || "stripe_confirm_error", error.code);
      } else if (paymentIntent) {
        // Vérification serveur : la commande n'est marquée payée qu'après contrôle auprès de Stripe.
        const v = address?.value;
        const res = await confirmStripePayment(
          paymentIntent.id,
          v
            ? {
                name: v.name,
                email,
                address: [v.address.line1, v.address.line2].filter(Boolean).join(" "),
                postalCode: v.address.postal_code,
                city: v.address.city,
                phone: v.phone ?? "",
                country: v.address.country,
              }
            : undefined,
        );
        if (res.ok && res.data.status === "succeeded") {
          trackPurchase({ transaction_id: res.data.number, value: order.totalAmount, coupon: order.appliedCoupon?.code });
          clearCart();
          router.push(`/confirmation?status=success&order=${res.data.orderId}&payment_id=${paymentIntent.id}`);
        } else if (res.ok) {
          setFeedback({ text: "Votre banque confirme le paiement : la page se mettra à jour dès réception.", kind: "info" });
        } else {
          setFeedback({ text: res.error, kind: "error" });
        }
      }
    } catch {
      setFeedback({ text: "Le paiement n'a pas pu aboutir pour une raison technique. Aucun montant n'a été débité. Réessayez.", kind: "error" });
      trackPaymentError("technical_error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-8">
      <Field label="Email pour le reçu" htmlFor="email" error={ef.errors.email}>
        <Input
          type="email"
          id="email"
          value={email}
          invalid={!!ef.errors.email}
          onChange={(e) => {
            setEmail(e.target.value);
            ef.onChange("email", e.target.value, rules.email);
          }}
          onBlur={(e) => ef.onBlur("email", e.target.value, rules.email)}
          autoComplete="email"
          placeholder="nom@exemple.fr"
        />
      </Field>
      <div>
        <p className="mb-4 text-sm font-medium">Adresse de facturation</p>
        <AddressElement options={{ mode: "billing", fields: { phone: "always" }, validation: { phone: { required: "always" } } }} />
      </div>
      <div>
        <p className="mb-4 text-sm font-medium">Carte bancaire</p>
        <PaymentElement />
      </div>
      {feedback && <Feedback text={feedback.text} kind={feedback.kind} />}
      <Button type="submit" size="lg" block disabled={!stripe || loading} plain={loading} icon={loading ? undefined : <IconLock size={16} />}>
        {loading ? (
          <>
            <Spinner /> Paiement en cours…
          </>
        ) : (
          `Payer ${formatEuros(order.totalAmount)}`
        )}
      </Button>
      <p className="text-center text-xs text-graphite">Paiement chiffré et traité par Stripe. Nous ne voyons jamais votre numéro de carte.</p>
    </form>
  );
}

/** Virement bancaire avant livraison : adresse de facturation, puis confirmation de la commande. */
const BILLING_RULES = {
  name: rules.name,
  email: rules.email,
  address: rules.street,
  postalCode: rules.postalCode,
  city: rules.city,
  phone: rules.phone,
};

function BankTransferForm({ order }: { order: OrderDTO }) {
  const router = useRouter();
  const { clearCart } = useCart();
  const { data: session } = useSession();
  const ship = order.shippingAddress;
  const [billing, setBilling] = useState({
    name: ship?.fullName ?? session?.user?.name ?? "",
    email: session?.user?.email ?? "",
    address: ship?.address ?? "",
    postalCode: ship?.postalCode ?? "",
    city: ship?.city ?? "",
    phone: ship?.phone ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    const user = session?.user;
    if (user) setBilling((b) => ({ ...b, email: b.email || user.email || "", name: b.name || user.name || "" }));
  }, [session?.user]);

  const f = useFieldErrors<keyof typeof billing>({ name: "bill-name", email: "bill-email", address: "bill-address", postalCode: "bill-postalCode", city: "bill-city", phone: "bill-phone" });
  const set = (k: keyof typeof billing) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setBilling((b) => ({ ...b, [k]: e.target.value }));
    f.onChange(k, e.target.value, BILLING_RULES[k]);
  };

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!f.validateAll(billing, BILLING_RULES)) return;
    setLoading(true);
    trackAddPaymentInfo({ payment_type: "bank_transfer", value: order.totalAmount, coupon: order.appliedCoupon?.code });
    const res = await confirmBankTransfer(order._id, { ...billing, country: "FR" });
    setLoading(false);
    if (res.ok) {
      trackPurchase({ transaction_id: res.data.number, value: order.totalAmount, coupon: order.appliedCoupon?.code });
      clearCart();
      router.push(`/confirmation?status=success&order=${res.data.orderId}`);
    } else {
      trackPaymentError(res.error);
      setFeedback(res.error);
    }
  };

  const fields: { k: keyof typeof billing; label: string; type?: string; auto: string; full?: boolean; extra?: Record<string, unknown> }[] = [
    { k: "name", label: "Nom complet", auto: "name", full: true },
    { k: "email", label: "Email", type: "email", auto: "email", full: true },
    { k: "address", label: "Adresse", auto: "street-address", full: true },
    { k: "postalCode", label: "Code postal", auto: "postal-code", extra: { maxLength: 5, inputMode: "numeric" } },
    { k: "city", label: "Ville", auto: "address-level2" },
    { k: "phone", label: "Téléphone", type: "tel", auto: "tel", full: true },
  ];

  return (
    <form onSubmit={confirm} noValidate className="flex flex-col gap-8">
      <div className="bg-mist p-5 text-sm sm:p-6" data-testid="transfer-explainer">
        <p className="font-medium">Paiement par virement bancaire, avant livraison</p>
        <ol className="mt-4 flex flex-col gap-3 text-graphite">
          {[
            "Confirmez la commande : vos articles sont réservés.",
            "Vous recevez aussitôt par email la facture avec nos coordonnées bancaires et la référence à indiquer.",
            "Dès réception du virement, nous préparons votre commande et vous appelons pour fixer la livraison.",
          ].map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="t-spec mt-0.5 text-ink">0{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
      <div>
        <p className="mb-5 text-sm font-medium">Adresse de facturation</p>
        <div className="grid gap-5 sm:grid-cols-2">
          {fields.map((fd) => (
            <Field key={fd.k} label={fd.label} htmlFor={`bill-${fd.k}`} error={f.errors[fd.k]} className={fd.full ? "sm:col-span-2" : undefined}>
              <Input
                id={`bill-${fd.k}`}
                type={fd.type ?? "text"}
                value={billing[fd.k]}
                invalid={!!f.errors[fd.k]}
                onChange={set(fd.k)}
                onBlur={(e) => f.onBlur(fd.k, e.target.value, BILLING_RULES[fd.k])}
                autoComplete={fd.auto}
                {...fd.extra}
              />
            </Field>
          ))}
        </div>
      </div>
      {feedback && <Feedback text={feedback} />}
      <Button type="submit" size="lg" block disabled={loading} plain={loading} data-testid="bank-transfer">
        {loading ? (
          <>
            <Spinner /> Confirmation…
          </>
        ) : (
          `Confirmer la commande (${formatEuros(order.totalAmount)})`
        )}
      </Button>
    </form>
  );
}

/** Temps restant avant la libération des articles réservés. */
function useCountdown(expiresAt: string | null | undefined) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setLeft(Math.max(0, new Date(expiresAt).getTime() - Date.now()));
    tick();
    const t = window.setInterval(tick, 15000);
    return () => window.clearInterval(t);
  }, [expiresAt]);
  return left;
}

/** Page de paiement : formulaire de paiement + récapitulatif de la commande en attente. */
export function PaymentPage({ settings }: { settings: SiteSettings }) {
  const router = useRouter();
  const { status } = useSession();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [card, setCard] = useState(false);
  const [transfer, setTransfer] = useState(false);
  const [method, setMethod] = useState<"card" | "transfer">("card");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderDTO | null>(null);
  const left = useCountdown(order?.expiresAt);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/connexion?callbackUrl=/paiement");
      return;
    }
    if (status !== "authenticated") return;
    (async () => {
      setLoading(true);
      const latest = await fetchLatestOrder();
      if (!latest.ok) {
        if (latest.status === 404) {
          router.push("/panier");
          return;
        }
        setError("Votre commande n'a pas pu être récupérée. Rechargez la page ou revenez au panier.");
        setLoading(false);
        return;
      }
      setOrder(latest.data);
      const intent = await createPaymentIntent();
      if (!intent.ok) setError(intent.error || "Le paiement n'a pas pu être initialisé. Réessayez dans un instant.");
      else {
        const cardReady = intent.data.provider === "stripe" && !!stripePromise && !!intent.data.clientSecret;
        setCard(cardReady);
        setTransfer(intent.data.bankTransfer || !cardReady);
        setMethod(cardReady ? "card" : "transfer");
        setClientSecret(intent.data.clientSecret);
      }
      setLoading(false);
    })();
  }, [router, status]);

  const itemsCount = useMemo(() => order?.items.reduce((s, i) => s + i.quantity, 0) ?? 0, [order]);

  if (status === "loading" || loading) {
    return (
      <p className="flex min-h-[40vh] items-center justify-center gap-3 text-graphite" role="status">
        <Spinner /> Préparation du paiement…
      </p>
    );
  }
  if (error || !order) {
    return (
      <div className="flex max-w-xl flex-col items-start gap-6 border-t border-ink py-12">
        <Feedback text={error ?? "Aucune commande en attente de paiement."} />
        <ButtonLink href="/panier" variant="outline" icon={<Arrow direction="left" />}>
          Revenir au panier
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-16">
      <section className="border-t border-ink pt-6" aria-labelledby="paiement-titre">
        <h2 id="paiement-titre" className="t-h3 mb-8">
          Règlement
        </h2>
        {card && transfer && (
          <div role="radiogroup" aria-label="Mode de règlement" className="mb-8 grid gap-3 sm:grid-cols-2">
            {(
              [
                ["card", "Carte bancaire en ligne"],
                ["transfer", "Virement bancaire"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={method === value}
                onClick={() => setMethod(value)}
                className={cn("border px-4 py-3.5 text-left text-sm transition-colors", method === value ? "border-ink bg-ink text-paper" : "border-line hover:border-ink")}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {card && method === "card" && clientSecret && stripePromise && (
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: { theme: "stripe", variables: { colorPrimary: "#121212", colorText: "#121212", borderRadius: "4px", fontFamily: "system-ui, sans-serif" } },
            }}
          >
            <StripeForm order={order} />
          </Elements>
        )}
        {transfer && method === "transfer" && <BankTransferForm order={order} />}
      </section>

      <aside aria-label="Votre commande" className="lg:sticky lg:top-[calc(var(--header-h)+28px)] lg:self-start">
        <div className="bg-mist p-6 lg:p-8">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="t-h3">Votre commande</h2>
            <span className="t-spec text-graphite">{order.number}</span>
          </div>
          {left != null && order.expiresAt && (
            <p className="mt-4 flex items-center gap-2 text-sm">
              <IconClock size={16} />
              {left > 0 ? `Articles réservés encore ${Math.max(1, Math.round(left / 60000))} min` : "La réservation a expiré : revenez au panier pour la renouveler."}
            </p>
          )}
          <ul className="mt-6 divide-y divide-line border-y border-line">
            {order.items.map((it, i) => (
              <li key={i} className="flex gap-4 py-4">
                <div className="size-16 shrink-0 bg-paper p-1.5">
                  <ImageComponent size={64} img={it.imagePrincipale.url} alt="" className="size-full object-contain" />
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="line-clamp-2 font-medium">{displayTitle(it.title, it.marque)}</p>
                  <p className="t-spec mt-1 text-graphite">Qté {it.quantity}</p>
                </div>
                <p className="t-price text-sm">{formatEuros(it.price * it.quantity)}</p>
              </li>
            ))}
          </ul>
          <div className="mt-5 text-sm">
            <p className="font-medium">{order.isPickupInStore ? "Retrait en magasin" : `${DELIVERY_LABELS[order.deliveryMethod ?? ""] ?? "Livraison"}${order.includeOldItemPickup ? " + reprise" : ""}`}</p>
            <p className="mt-1 text-graphite">
              {order.isPickupInStore
                ? `${settings.addressLine}, ${settings.postalCode} ${settings.city}`
                : order.shippingAddress && `${order.shippingAddress.fullName}, ${order.shippingAddress.address}, ${order.shippingAddress.postalCode} ${order.shippingAddress.city}`}
            </p>
          </div>
          <dl className="t-price mt-5 flex flex-col gap-2 border-t border-line pt-5 text-sm">
            <div className="flex justify-between">
              <dt className="text-graphite">Articles ({itemsCount})</dt>
              <dd>{formatEuros(order.subtotal)}</dd>
            </div>
            {order.appliedCoupon && (
              <div className="flex justify-between text-success">
                <dt>Réduction {order.appliedCoupon.code}</dt>
                <dd>−{formatEuros(order.appliedCoupon.discount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-graphite">{order.isPickupInStore ? "Retrait" : "Livraison"}</dt>
              <dd>{order.isPickupInStore ? "Gratuit" : formatEuros(order.deliveryFee)}</dd>
            </div>
            <div className="mt-3 flex items-baseline justify-between border-t border-ink pt-4">
              <dt className="font-medium">Total TTC</dt>
              <dd className="font-display text-2xl font-medium [font-stretch:110%]" data-testid="payment-total">
                {formatEuros(order.totalAmount)}
              </dd>
            </div>
          </dl>
          <Link href="/panier" className="link-underline mt-6 inline-flex items-center gap-2 text-sm">
            <Arrow direction="left" /> Modifier le panier
          </Link>
        </div>
      </aside>
    </div>
  );
}

export default PaymentPage;
