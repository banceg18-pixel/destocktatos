import "server-only";
import Stripe from "stripe";
import type { Order } from "@prisma/client";

/**
 * Fournisseurs de paiement.
 * - Stripe : utilisé dès que STRIPE_SECRET_KEY est défini. Le statut est toujours vérifié côté
 *   serveur auprès de Stripe (jamais sur la seule parole du client).
 * - Paiement à la livraison ou au retrait (« sur_place ») : proposé sans clé Stripe, ou en plus de
 *   Stripe avec PAY_ON_DELIVERY=true. La commande est confirmée sans paiement en ligne ; le magasin
 *   constate le règlement en passant la commande à « Livrée ».
 * - Simulation (« test ») : réservée aux tests automatisés, activée seulement par TEST_PAYMENTS=true.
 */
export type PaymentStatus = "succeeded" | "processing" | "requires_action" | "failed" | "canceled";

export interface PaymentProvider {
  name: "stripe" | "sur_place";
  mode: "live" | "test";
  createIntent(order: Order, email?: string | null): Promise<{ clientSecret: string | null; providerRef: string }>;
  retrieve(providerRef: string): Promise<{ status: PaymentStatus; orderId: string | null; amountCents: number }>;
}

let stripeClient: Stripe | null = null;
export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  stripeClient ??= new Stripe(process.env.STRIPE_SECRET_KEY);
  return stripeClient;
}

const stripeProvider = (stripe: Stripe): PaymentProvider => ({
  name: "stripe",
  mode: process.env.STRIPE_SECRET_KEY!.startsWith("sk_live") ? "live" : "test",
  async createIntent(order, email) {
    const intent = await stripe.paymentIntents.create(
      {
        amount: order.totalCents,
        currency: "eur",
        automatic_payment_methods: { enabled: true },
        receipt_email: email ?? undefined,
        description: `Commande ${order.number}`,
        metadata: { orderId: order.id, orderNumber: order.number },
      },
      // Idempotence : une seule intention par commande et par montant.
      { idempotencyKey: `order-${order.id}-${order.totalCents}` },
    );
    return { clientSecret: intent.client_secret, providerRef: intent.id };
  },
  async retrieve(ref) {
    const pi = await stripe.paymentIntents.retrieve(ref);
    const map: Record<string, PaymentStatus> = {
      succeeded: "succeeded",
      processing: "processing",
      requires_action: "requires_action",
      requires_payment_method: "failed",
      requires_confirmation: "processing",
      requires_capture: "processing",
      canceled: "canceled",
    };
    return { status: map[pi.status] ?? "processing", orderId: (pi.metadata?.orderId as string) ?? null, amountCents: pi.amount };
  },
});

/** Référence du règlement à la livraison ou au retrait d'une commande. */
export const onDeliveryRef = (orderId: string) => `sur_place_${orderId}`;

const onDeliveryProvider: PaymentProvider = {
  name: "sur_place",
  mode: "live",
  async createIntent(order) {
    return { clientSecret: null, providerRef: onDeliveryRef(order.id) };
  },
  async retrieve(ref) {
    return { status: "processing", orderId: ref.replace(/^sur_place_/, ""), amountCents: 0 };
  },
};

export function getPaymentProvider(): PaymentProvider {
  const stripe = getStripe();
  return stripe ? stripeProvider(stripe) : onDeliveryProvider;
}

/** Paiement à la livraison ou au retrait : toujours proposé sans Stripe, en option avec Stripe. */
export function isPayOnDeliveryEnabled() {
  return !getStripe() || process.env.PAY_ON_DELIVERY === "true";
}

/** Simulation de paiement : uniquement pour les tests automatisés (jamais visible des clients). */
export function isTestPaymentEnabled() {
  return !getStripe() && process.env.TEST_PAYMENTS === "true";
}
