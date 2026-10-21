/**
 * Événements e-commerce GA4 (mêmes noms et charges utiles que le site source).
 * Sans effet si Google Analytics n'est pas chargé (désactivé par défaut / sans consentement).
 */
type Item = { _id: string; titre: string; marque?: string; prix: number; promotionPrix?: number | null; quantity?: number };

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    fbq?: (...args: unknown[]) => void;
  }
}

function send(event: string, params: Record<string, unknown> = {}) {
  try {
    if (typeof window.gtag === "function") window.gtag("event", event, params);
    if (Array.isArray(window.dataLayer)) window.dataLayer.push({ event, ...params });
  } catch {
    /* analytics ne doit jamais casser l'interface */
  }
}

/** Événement standard du Pixel Meta (sans effet si le Pixel n'est pas chargé). */
function meta(event: string, params: Record<string, unknown> = {}, eventId?: string) {
  try {
    if (typeof window.fbq === "function") window.fbq("track", event, params, eventId ? { eventID: eventId } : undefined);
  } catch {
    /* le suivi ne doit jamais casser l'interface */
  }
}

function items(list: Item[]) {
  return list.map((e) => ({
    item_id: e._id,
    item_name: e.titre,
    item_brand: e.marque || undefined,
    price: Number(e.promotionPrix ?? e.prix) || 0,
    quantity: Number(e.quantity ?? 1) || 1,
    currency: "EUR",
  }));
}

export function trackAddToCart(item: Item, quantity = 1) {
  send("add_to_cart", {
    currency: "EUR",
    value: (Number(item.promotionPrix ?? item.prix) || 0) * Math.max(1, quantity),
    items: items([{ ...item, quantity }]),
  });
  meta("AddToCart", { currency: "EUR", value: (Number(item.promotionPrix ?? item.prix) || 0) * Math.max(1, quantity), content_ids: [item._id], content_type: "product" });
}

export function trackBeginCheckout(list: Item[], value?: number, coupon?: string) {
  send("begin_checkout", { currency: "EUR", value, coupon: coupon || undefined, items: items(list) });
  meta("InitiateCheckout", { currency: "EUR", value, num_items: list.reduce((n, i) => n + (i.quantity ?? 1), 0), content_ids: list.map((i) => i._id) });
}

export function trackAddPaymentInfo(p: { value?: number; coupon?: string; payment_type?: string }) {
  send("add_payment_info", { currency: "EUR", value: p.value, coupon: p.coupon || undefined, payment_type: p.payment_type || "card" });
  meta("AddPaymentInfo", { currency: "EUR", value: p.value });
}

export function trackPaymentError(message: string, code?: string) {
  send("payment_error", { message, code: code || undefined });
}

export function trackPurchase(p: { transaction_id: string; value?: number; coupon?: string; items?: Item[] }) {
  send("purchase", {
    transaction_id: p.transaction_id,
    currency: "EUR",
    value: p.value,
    coupon: p.coupon || undefined,
    items: p.items ? items(p.items) : undefined,
  });
  // Même identifiant que l'événement envoyé par le serveur (API Conversions) : compté une seule fois.
  meta("Purchase", { currency: "EUR", value: p.value }, p.transaction_id);
}
