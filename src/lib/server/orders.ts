import "server-only";
import crypto from "node:crypto";
import type { Order, OrderItem, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toEuros } from "@/lib/money";
import { STORE_COORDINATES, calculateDeliveryFee, calculateDistance, type DeliveryMethod } from "@/lib/delivery";
import { geocodeAddress, type LatLng } from "@/lib/geocode";
import { invalidateCatalog } from "@/lib/catalog/repository";
import { notifyOrderPaid } from "./notifications";
import { ApiError } from "./api";
import { evaluateCoupon } from "./coupons";
import { onDeliveryRef } from "./payments";

/** Une commande non payée réserve son stock pendant 30 minutes. */
export const PENDING_TTL_MS = 30 * 60 * 1000;

export type Geocoder = (address: string, city: string, postalCode: string) => Promise<LatLng | null>;

export interface OrderRequest {
  items: { _id: string; quantity: number }[];
  totalAmount: number;
  deliveryMethod: DeliveryMethod | null;
  includeOldItemPickup: boolean;
  isPickupInStore: boolean;
  shippingAddress: {
    fullName: string;
    address: string;
    city: string;
    postalCode: string;
    phone: string;
    additionalInfo: string;
    floor: number;
  } | null;
  couponCode: string | null;
}

export interface Quote {
  lines: { productId: string; titre: string; marque: string; imagePrincipale: string | null; unitPriceCents: number; originalPriceCents: number; quantity: number; lineTotalCents: number; poids: number }[];
  subtotalCents: number;
  discountCents: number;
  couponId: string | null;
  couponCode: string | null;
  couponMessage: string | null;
  deliveryFeeCents: number;
  deliveryDistanceKm: number;
  totalWeightKg: number;
  totalCents: number;
}

type Db = Prisma.TransactionClient | typeof prisma;

/** Recalcule entièrement la commande à partir de la base (prix, stock, livraison, coupon). */
export async function quoteOrder(
  db: Db,
  userId: string,
  req: OrderRequest,
  opts: { geocoder?: Geocoder; distanceKm?: number } = {},
): Promise<Quote> {
  if (!req.items.length) throw new ApiError(400, "Panier vide.");
  const merged = new Map<string, number>();
  for (const it of req.items) merged.set(it._id, (merged.get(it._id) ?? 0) + it.quantity);

  const products = await db.product.findMany({ where: { id: { in: [...merged.keys()] } } });
  const lines: Quote["lines"] = [];
  for (const [id, quantity] of merged) {
    const p = products.find((x) => x.id === id);
    if (!p) throw new ApiError(404, "Un produit de votre panier n'est plus disponible. Veuillez mettre à jour votre panier.");
    if (p.stock < quantity) {
      throw new ApiError(
        409,
        p.stock <= 0
          ? `« ${p.titre} » est en rupture de stock. Veuillez le retirer de votre panier.`
          : `Stock insuffisant pour « ${p.titre} » : ${p.stock} disponible(s).`,
        { productId: p.id, available: p.stock },
      );
    }
    const unit = p.promotionPrixCents && p.promotionPrixCents > 0 ? p.promotionPrixCents : p.prixCents;
    const carac = (p.caracteristiques ?? {}) as { poids?: number };
    lines.push({
      productId: p.id,
      titre: p.titre,
      marque: p.marque,
      imagePrincipale: p.imagePrincipale,
      unitPriceCents: unit,
      originalPriceCents: p.prixCents,
      quantity,
      lineTotalCents: unit * quantity,
      poids: carac.poids ?? 0,
    });
  }
  const subtotalCents = lines.reduce((s, l) => s + l.lineTotalCents, 0);
  const totalWeightKg = lines.reduce((s, l) => s + l.poids * l.quantity, 0);

  let discountCents = 0;
  let couponId: string | null = null;
  let couponCode: string | null = null;
  let couponMessage: string | null = null;
  if (req.couponCode) {
    const c = await evaluateCoupon(db, userId, req.couponCode, subtotalCents);
    discountCents = c.discountCents;
    couponId = c.coupon.id;
    couponCode = c.coupon.code;
    couponMessage = c.message;
  }

  let deliveryFeeCents = 0;
  let deliveryDistanceKm = 0;
  if (!req.isPickupInStore) {
    const a = req.shippingAddress;
    if (!a) throw new ApiError(400, "Adresse de livraison incomplète. Veuillez remplir tous les champs obligatoires ou choisir le retrait en magasin.");
    if (!req.deliveryMethod) throw new ApiError(400, "Veuillez sélectionner une méthode de livraison.");
    // Livraison offerte partout en France : la distance (adresse géocodée) reste enregistrée pour la tournée.
    deliveryDistanceKm = opts.distanceKm ?? (await distanceTo(a, opts.geocoder ?? geocodeAddress));
    deliveryFeeCents = calculateDeliveryFee(req.deliveryMethod, req.deliveryMethod === "installation" && req.includeOldItemPickup) * 100;
  }

  const totalCents = Math.max(0, subtotalCents - discountCents + deliveryFeeCents);
  return { lines, subtotalCents, discountCents, couponId, couponCode, couponMessage, deliveryFeeCents, deliveryDistanceKm, totalWeightKg, totalCents };
}

/** Distance (km) entre le magasin et l'adresse de livraison, calculée côté serveur. */
export async function distanceTo(a: { address: string; city: string; postalCode: string }, geocoder: Geocoder = geocodeAddress) {
  const coords = await geocoder(a.address, a.city, a.postalCode);
  if (!coords) throw new ApiError(422, "Impossible de calculer la distance de livraison. Veuillez vérifier votre adresse.");
  const d = calculateDistance(coords.lat, coords.lng, STORE_COORDINATES.lat, STORE_COORDINATES.lng);
  return d <= 0 ? 1 : d; // adresse du magasin : distance minimale facturable
}

function orderNumber() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `TAT-${ymd}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

/** Remet en stock les articles d'une commande annulée. */
async function restock(tx: Prisma.TransactionClient, items: OrderItem[]) {
  for (const it of items) await tx.product.update({ where: { id: it.productId }, data: { stock: { increment: it.quantity } } });
}

/** Annule les commandes non payées expirées (libère le stock réservé). */
export async function expireStaleOrders(userId?: string) {
  const stale = await prisma.order.findMany({
    where: { status: "EN_ATTENTE_PAIEMENT", createdAt: { lt: new Date(Date.now() - PENDING_TTL_MS) }, ...(userId ? { userId } : {}) },
    include: { items: true },
  });
  for (const o of stale) {
    await prisma.$transaction(async (tx) => {
      const r = await tx.order.updateMany({ where: { id: o.id, status: "EN_ATTENTE_PAIEMENT" }, data: { status: "ANNULEE" } });
      if (r.count === 1) await restock(tx, o.items);
    });
  }
  if (stale.length) invalidateCatalog();
  return stale.length;
}

/**
 * Crée la commande : recalcul serveur, contrôle du total affiché, réservation atomique du stock,
 * annulation des précédentes commandes non payées du client. Tout ou rien (transaction).
 */
export async function createOrder(userId: string, req: OrderRequest, geocoder?: Geocoder) {
  await expireStaleOrders(userId);
  // Appel réseau (géocodage) hors transaction ; tout le reste est recalculé dans la transaction.
  const distanceKm = req.isPickupInStore || !req.shippingAddress ? undefined : await distanceTo(req.shippingAddress, geocoder);
  const created = await prisma.$transaction(async (tx) => {
    // Une seule commande à payer à la fois : les précédentes commandes en attente sont annulées.
    const previous = await tx.order.findMany({ where: { userId, status: "EN_ATTENTE_PAIEMENT" }, include: { items: true } });
    for (const o of previous) {
      await tx.order.update({ where: { id: o.id }, data: { status: "ANNULEE" } });
      await restock(tx, o.items);
    }
    const quote = await quoteOrder(tx, userId, req, { distanceKm });
    if (Math.abs(quote.totalCents - Math.round(req.totalAmount * 100)) > 1) {
      throw new ApiError(
        409,
        `Le total de votre commande a été recalculé (${toEuros(quote.totalCents).toLocaleString("fr-FR")} €). Veuillez vérifier votre panier.`,
        { totalAmount: toEuros(quote.totalCents) },
      );
    }
    // Réservation atomique : la décrémentation échoue si le stock a changé entre-temps.
    for (const l of quote.lines) {
      const r = await tx.product.updateMany({ where: { id: l.productId, stock: { gte: l.quantity } }, data: { stock: { decrement: l.quantity } } });
      if (r.count !== 1) throw new ApiError(409, `Stock insuffisant pour « ${l.titre} ».`, { productId: l.productId });
    }
    const order = await tx.order.create({
      data: {
        number: orderNumber(),
        userId,
        status: "EN_ATTENTE_PAIEMENT",
        subtotalCents: quote.subtotalCents,
        discountCents: quote.discountCents,
        deliveryFeeCents: quote.deliveryFeeCents,
        totalCents: quote.totalCents,
        deliveryMethod: req.isPickupInStore ? null : req.deliveryMethod,
        includeOldItemPickup: !req.isPickupInStore && req.deliveryMethod === "installation" && req.includeOldItemPickup,
        deliveryDistanceKm: quote.deliveryDistanceKm,
        isPickupInStore: req.isPickupInStore,
        shippingAddress: req.isPickupInStore || !req.shippingAddress ? undefined : req.shippingAddress,
        couponCode: quote.couponCode,
        items: {
          create: quote.lines.map((l) => ({
            productId: l.productId,
            titre: l.titre,
            marque: l.marque,
            imagePrincipale: l.imagePrincipale,
            unitPriceCents: l.unitPriceCents,
            quantity: l.quantity,
            lineTotalCents: l.lineTotalCents,
          })),
        },
      },
      include: { items: true },
    });
    return { order, quote };
  });
  // Stock réservé : le catalogue en cache est relu à la prochaine demande.
  invalidateCatalog();
  return created;
}

export interface OrderAddress {
  fullName: string;
  address: string;
  postalCode: string;
  city: string;
  phone: string;
  additionalInfo?: string;
  floor?: number;
}

type OrderWithItems = Order & { items: (OrderItem & { product?: { prixCents: number; slug: string } | null })[] };

/** Représentation renvoyée au frontend (format attendu par la page de paiement source). */
export function toOrderDTO(o: OrderWithItems) {
  const expiresAt = new Date(o.createdAt.getTime() + PENDING_TTL_MS);
  return {
    _id: o.id,
    number: o.number,
    status: o.status,
    createdAt: o.createdAt.toISOString(),
    paidAt: o.paidAt?.toISOString() ?? null,
    expiresAt: o.status === "EN_ATTENTE_PAIEMENT" ? expiresAt.toISOString() : null,
    items: o.items.map((i) => ({
      productId: i.productId,
      slug: i.product?.slug ?? null,
      title: i.titre,
      marque: i.marque,
      imagePrincipale: { url: i.imagePrincipale ?? "" },
      quantity: i.quantity,
      price: toEuros(i.unitPriceCents),
      originalPrice: i.product ? toEuros(i.product.prixCents) : toEuros(i.unitPriceCents),
    })),
    subtotal: toEuros(o.subtotalCents),
    deliveryFee: toEuros(o.deliveryFeeCents),
    deliveryMethod: o.deliveryMethod,
    includeOldItemPickup: o.includeOldItemPickup,
    deliveryDistance: o.deliveryDistanceKm,
    isPickupInStore: o.isPickupInStore,
    shippingAddress: o.shippingAddress as OrderAddress | null,
    billingAddress: o.billingAddress as Record<string, string> | null,
    appliedCoupon: o.couponCode ? { code: o.couponCode, discount: toEuros(o.discountCents) } : null,
    totalAmount: toEuros(o.totalCents),
    paymentProvider: o.paymentProvider,
    paymentMode: o.paymentMode,
  };
}

const orderInclude = { items: { include: { product: { select: { prixCents: true, slug: true } } } } } satisfies Prisma.OrderInclude;

export async function getLatestPendingOrder(userId: string) {
  await expireStaleOrders(userId);
  return prisma.order.findFirst({ where: { userId, status: "EN_ATTENTE_PAIEMENT" }, orderBy: { createdAt: "desc" }, include: orderInclude });
}

export async function getUserOrder(userId: string, id: string) {
  const o = await prisma.order.findUnique({ where: { id }, include: { ...orderInclude, payments: true } });
  if (!o || o.userId !== userId) throw new ApiError(404, "Commande introuvable");
  return o;
}

export async function listUserOrders(userId: string) {
  await expireStaleOrders(userId);
  return prisma.order.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, include: orderInclude });
}

/** Annulation par le client d'une commande non payée (stock libéré). */
export async function cancelPendingOrder(userId: string, id: string) {
  const o = await getUserOrder(userId, id);
  if (o.status !== "EN_ATTENTE_PAIEMENT") throw new ApiError(409, "Seule une commande en attente de paiement peut être annulée.");
  await prisma.$transaction(async (tx) => {
    const r = await tx.order.updateMany({ where: { id, status: "EN_ATTENTE_PAIEMENT" }, data: { status: "ANNULEE" } });
    if (r.count === 1) await restock(tx, o.items);
  });
  invalidateCatalog();
}

/** Consomme le code promo d'une commande (une seule fois par commande). */
async function redeemCoupon(tx: Prisma.TransactionClient, o: Order) {
  if (!o.couponCode) return;
  const coupon = await tx.coupon.findUnique({ where: { code: o.couponCode } });
  if (!coupon) return;
  const existing = await tx.couponRedemption.findUnique({ where: { orderId: o.id } });
  if (existing) return;
  await tx.couponRedemption.create({ data: { couponId: coupon.id, userId: o.userId, orderId: o.id, discountCents: o.discountCents } });
  await tx.coupon.update({ where: { id: coupon.id }, data: { usedCount: { increment: 1 } } });
}

/**
 * Marque une commande payée (idempotent). Enregistre le paiement et consomme le coupon.
 * Appelé uniquement après vérification serveur du paiement (Stripe, ou simulation des tests automatisés).
 */
export async function markOrderPaid(orderId: string, payment: { provider: string; mode: "live" | "test"; providerRef: string; details?: Prisma.InputJsonValue }) {
  let transitioned = false;
  const paid = await prisma.$transaction(async (tx) => {
    const o = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!o) throw new ApiError(404, "Commande introuvable");
    if (o.status === "PAYEE" || o.status === "EN_PREPARATION" || o.status === "EXPEDIEE" || o.status === "LIVREE") return o;
    if (o.status === "ANNULEE") {
      // Paiement reçu après expiration : on tente de réserver à nouveau le stock.
      for (const it of o.items) {
        const r = await tx.product.updateMany({ where: { id: it.productId, stock: { gte: it.quantity } }, data: { stock: { decrement: it.quantity } } });
        if (r.count !== 1) console.warn(`[orders] Stock insuffisant après paiement de la commande ${o.number} (produit ${it.productId}) — traitement manuel requis.`);
      }
    }
    await tx.payment.upsert({
      where: { id: `${orderId}-${payment.providerRef}`.slice(0, 190) },
      update: { status: "REUSSI", details: payment.details },
      create: {
        id: `${orderId}-${payment.providerRef}`.slice(0, 190),
        orderId,
        provider: payment.provider,
        mode: payment.mode,
        providerRef: payment.providerRef,
        amountCents: o.totalCents,
        status: "REUSSI",
        details: payment.details,
      },
    });
    await redeemCoupon(tx, o);
    transitioned = true;
    return tx.order.update({
      where: { id: orderId },
      data: { status: "PAYEE", paidAt: new Date(), paymentProvider: payment.provider, paymentMode: payment.mode, paymentIntentId: payment.providerRef },
    });
  });
  invalidateCatalog();
  // Une seule confirmation par commande, même si Stripe et la page de retour confirment tous deux.
  if (transitioned) notifyOrderPaid(paid.id).catch((e) => console.error("[notifications] confirmation de commande", e));
  return paid;
}

/**
 * Commande confirmée avec règlement à la livraison ou au retrait : aucun paiement en ligne. Les
 * articles restent réservés, le code promo est consommé et la commande passe en préparation. Le
 * magasin constate le règlement en passant la commande à « Livrée » (voir adminSetOrderStatus).
 */
export async function confirmPayOnDelivery(orderId: string) {
  const ref = onDeliveryRef(orderId);
  const confirmed = await prisma.$transaction(async (tx) => {
    const o = await tx.order.findUnique({ where: { id: orderId } });
    if (!o) throw new ApiError(404, "Commande introuvable");
    const r = await tx.order.updateMany({
      where: { id: orderId, status: "EN_ATTENTE_PAIEMENT" },
      data: { status: "EN_PREPARATION", paymentProvider: "sur_place", paymentMode: "live", paymentIntentId: ref },
    });
    if (r.count !== 1) throw new ApiError(409, "Cette commande est déjà confirmée.");
    // Une intention de paiement en ligne préparée puis abandonnée est close.
    await tx.payment.updateMany({ where: { orderId, status: "EN_ATTENTE", provider: { not: "sur_place" } }, data: { status: "ANNULE" } });
    await tx.payment.upsert({
      where: { id: `${orderId}-${ref}`.slice(0, 190) },
      update: { status: "EN_ATTENTE", amountCents: o.totalCents },
      create: { id: `${orderId}-${ref}`.slice(0, 190), orderId, provider: "sur_place", mode: "live", providerRef: ref, amountCents: o.totalCents, status: "EN_ATTENTE" },
    });
    await redeemCoupon(tx, o);
    return tx.order.findUniqueOrThrow({ where: { id: orderId } });
  });
  notifyOrderPaid(confirmed.id).catch((e) => console.error("[notifications] confirmation de commande", e));
  return confirmed;
}

/** Paiement refusé : la commande reste payable (nouvel essai possible) ; l'échec est historisé. */
export async function recordPaymentFailure(orderId: string, payment: { provider: string; mode: "live" | "test"; providerRef: string; reason: string }) {
  const o = await prisma.order.findUnique({ where: { id: orderId } });
  if (!o) return;
  await prisma.payment.create({
    data: {
      orderId,
      provider: payment.provider,
      mode: payment.mode,
      providerRef: payment.providerRef,
      amountCents: o.totalCents,
      status: "ECHOUE",
      details: { reason: payment.reason },
    },
  });
}

/** Statuts que le magasin peut appliquer depuis l'administration. */
export const ADMIN_ORDER_STATUSES = ["EN_PREPARATION", "EXPEDIEE", "LIVREE", "ANNULEE"] as const;
export type AdminOrderStatus = (typeof ADMIN_ORDER_STATUSES)[number];

/**
 * Changement de statut décidé par le magasin. Une commande annulée ne peut plus changer ; une
 * annulation remet les articles en stock (le remboursement d'un paiement reçu se fait chez le
 * prestataire de paiement). Seules les commandes payées, ou à régler à la livraison, avancent vers
 * préparation, expédition, livraison ; « Livrée » enregistre alors le règlement reçu sur place.
 */
export async function adminSetOrderStatus(orderId: string, status: AdminOrderStatus) {
  const updated = await prisma.$transaction(async (tx) => {
    const o = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!o) throw new ApiError(404, "Commande introuvable");
    if (o.status === status) return o;
    if (o.status === "ANNULEE") throw new ApiError(409, "Cette commande est annulée : son statut ne peut plus changer.");
    const onDelivery = o.paymentProvider === "sur_place" && o.status !== "EN_ATTENTE_PAIEMENT";
    if (status !== "ANNULEE" && !o.paidAt && !onDelivery) throw new ApiError(409, "Cette commande n'est pas payée : elle peut seulement être annulée.");
    if (status === "ANNULEE") {
      const r = await tx.order.updateMany({ where: { id: orderId, status: { not: "ANNULEE" } }, data: { status } });
      if (r.count === 1) await restock(tx, o.items);
      await tx.payment.updateMany({ where: { orderId, status: "EN_ATTENTE" }, data: { status: "ANNULE" } });
      return tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    }
    if (status === "LIVREE" && onDelivery && !o.paidAt) {
      // Règlement encaissé à la remise de la commande.
      await tx.payment.updateMany({ where: { orderId, provider: "sur_place", status: "EN_ATTENTE" }, data: { status: "REUSSI" } });
      return tx.order.update({ where: { id: orderId }, data: { status, paidAt: new Date() }, include: { items: true } });
    }
    return tx.order.update({ where: { id: orderId }, data: { status }, include: { items: true } });
  });
  if (status === "ANNULEE") invalidateCatalog();
  return updated;
}
