import "server-only";
import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { invalidateCatalog } from "@/lib/catalog/repository";
import { SITE_URL } from "@/lib/seo";
import { ApiError, clientIp, json } from "./api";
import { rateLimit } from "./rate-limit";
import { sendMail, smtpConfigured } from "./mailer";
import { ADMIN_ORDER_STATUSES, adminSetOrderStatus } from "./orders";
import { bankDetailsOf } from "@/lib/bank";
import { buildInvoicePdf, invoiceAvailable, invoiceNumber, invoiceStore } from "./invoice";
import { getSiteSettings } from "@/lib/cms";
import { newsletterMessage, notifyOrderStatus } from "./notifications";
import { exportContent, exportProducts } from "./wp-export";

/**
 * API d'administration utilisée par l'espace WordPress (extension WordPress du site) : commandes, clients,
 * codes promo, avis, messages, newsletter et stock. Appels serveur à serveur uniquement, authentifiés
 * par la clé partagée `ADMIN_API_SECRET` (en-tête `Authorization: Bearer …`).
 */

export function requireAdminKey(req: Request) {
  const secret = process.env.ADMIN_API_SECRET;
  if (!secret) throw new ApiError(503, "Administration non configurée : définissez ADMIN_API_SECRET sur le serveur du site.");
  const given = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    if (!rateLimit(`admin-auth:${clientIp(req)}`, 20, 10 * 60 * 1000).ok) throw new ApiError(429, "Trop de tentatives.");
    throw new ApiError(401, "Clé d'administration invalide.");
  }
}

const paging = (url: URL, max = 100) => {
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const per = Math.min(max, Math.max(1, Number(url.searchParams.get("per")) || 25));
  return { page, per, skip: (page - 1) * per, take: per };
};
const list = <T>(items: T[], total: number, page: number, per: number) => json({ items, total, page, per, pages: Math.max(1, Math.ceil(total / per)) });
const q = (url: URL) => (url.searchParams.get("q") || "").trim();
/**
 * Variantes de casse d'un terme recherché : SQLite compare sans tenir compte de la casse (ASCII),
 * PostgreSQL en tient compte. Chercher les variantes usuelles donne le même résultat sur les deux.
 */
const caseVariants = (term: string) => [...new Set([term, term.toLowerCase(), term.toUpperCase(), term.charAt(0).toUpperCase() + term.slice(1).toLowerCase()])];
async function body<S extends z.ZodTypeAny>(req: Request, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, "Corps JSON invalide");
  }
  return schema.parse(raw);
}

const PAID = ["PAYEE", "EN_PREPARATION", "EXPEDIEE", "LIVREE"] as const;
const ANONYMIZED = "@compte-supprime.invalid";

/* ------------------------------------------------------------------------------------- Export WordPress */

/**
 * Contenus du site au format d'import de l'extension WordPress : `?part=content` (réglages, pages,
 * articles, FAQ, menus, catégories, nombre de produits) puis `?part=products&page=N&per=40`.
 */
async function exportForWordPress(url: URL) {
  if (url.searchParams.get("part") === "products") {
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const per = Math.min(100, Math.max(1, Number(url.searchParams.get("per")) || 40));
    return json({ products: await exportProducts(prisma, SITE_URL, (page - 1) * per, per) });
  }
  return json(await exportContent(prisma, SITE_URL));
}

/* ------------------------------------------------------------------------------------- Tableau de bord */

async function stats() {
  const since = new Date(Date.now() - 30 * 86400_000);
  const [byStatus, revenue30, revenueAll, customers, newCustomers, contacts, services, tickets, subscribers, lowStock, reviews, recent] = await Promise.all([
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.order.aggregate({ where: { status: { in: [...PAID] }, paidAt: { gte: since } }, _sum: { totalCents: true }, _count: { _all: true } }),
    prisma.order.aggregate({ where: { status: { in: [...PAID] }, paidAt: { not: null } }, _sum: { totalCents: true } }),
    prisma.user.count({ where: { NOT: { email: { endsWith: ANONYMIZED } } } }),
    prisma.user.count({ where: { createdAt: { gte: since }, NOT: { email: { endsWith: ANONYMIZED } } } }),
    prisma.contactMessage.count({ where: { status: "NOUVEAU" } }),
    prisma.serviceRequest.count({ where: { status: "NOUVEAU" } }),
    prisma.ticket.count({ where: { status: { in: ["OUVERT", "EN_COURS"] } } }),
    prisma.newsletterSubscriber.count(),
    prisma.product.findMany({ where: { stock: { lte: 1 } }, select: { id: true, titre: true, marque: true, modele: true, stock: true }, orderBy: { stock: "asc" }, take: 10 }),
    prisma.review.aggregate({ _count: { _all: true }, _avg: { note: true } }),
    prisma.order.findMany({ where: { status: { not: "EN_ATTENTE_PAIEMENT" } }, orderBy: { createdAt: "desc" }, take: 6, include: { user: { select: { name: true, email: true } } } }),
  ]);
  return json({
    orders: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
    toShip: byStatus.filter((s) => s.status === "PAYEE" || s.status === "EN_PREPARATION").reduce((n, s) => n + s._count._all, 0),
    awaitingTransfer: byStatus.find((s) => s.status === "EN_ATTENTE_VIREMENT")?._count._all ?? 0,
    revenue30Cents: revenue30._sum.totalCents ?? 0,
    orders30: revenue30._count._all,
    revenueAllCents: revenueAll._sum.totalCents ?? 0,
    customers,
    newCustomers,
    messages: { contact: contacts, services, tickets },
    subscribers,
    lowStock,
    lowStockCount: await prisma.product.count({ where: { stock: { lte: 1 } } }),
    reviews: { count: reviews._count._all, average: Math.round((reviews._avg.note ?? 0) * 10) / 10 },
    recentOrders: recent.map((o) => ({ id: o.id, number: o.number, status: o.status, totalCents: o.totalCents, createdAt: o.createdAt, customer: o.user.name, email: o.user.email })),
  });
}

/* ------------------------------------------------------------------------------------- Commandes */

async function listOrders(url: URL) {
  const { page, per, skip, take } = paging(url);
  const status = url.searchParams.get("status");
  const term = q(url);
  const where: Prisma.OrderWhereInput = {
    // « A_TRAITER » : commandes confirmées pas encore parties (payées ou à régler à la livraison).
    ...(status === "A_TRAITER"
      ? { status: { in: ["PAYEE", "EN_PREPARATION"] } }
      : status
        ? { status: status as Prisma.EnumOrderStatusFilter["equals"] }
        : { status: { not: "EN_ATTENTE_PAIEMENT" } }),
    ...(term ? { OR: [{ number: { contains: term.toUpperCase() } }, { user: { email: { contains: term.toLowerCase() } } }, ...caseVariants(term).map((v) => ({ user: { name: { contains: v } } }))] } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.order.findMany({ where, orderBy: { createdAt: "desc" }, skip, take, include: { user: { select: { name: true, email: true } }, _count: { select: { items: true } } } }),
    prisma.order.count({ where }),
  ]);
  return list(
    rows.map((o) => ({ id: o.id, number: o.number, status: o.status, totalCents: o.totalCents, createdAt: o.createdAt, paidAt: o.paidAt, items: o._count.items, pickup: o.isPickupInStore, customer: o.user.name, email: o.user.email, paymentProvider: o.paymentProvider, paymentMode: o.paymentMode })),
    total,
    page,
    per,
  );
}

async function getOrder(id: string) {
  const o = await prisma.order.findUnique({ where: { id }, include: { items: true, payments: { orderBy: { createdAt: "asc" } }, user: { select: { id: true, name: true, email: true } } } });
  if (!o) throw new ApiError(404, "Commande introuvable");
  return json(o);
}

/** Facture PDF d'une commande payée ou en attente de virement, pour le magasin (téléchargée par l'administration). */
async function orderInvoice(id: string) {
  const o = await prisma.order.findUnique({ where: { id }, include: { items: true, user: { select: { name: true, email: true } } } });
  if (!o) throw new ApiError(404, "Commande introuvable");
  if (!invoiceAvailable(o)) throw new ApiError(409, "La facture est disponible une fois la commande confirmée");
  const s = await getSiteSettings();
  const pdf = buildInvoicePdf(o, o.user, invoiceStore(s), bankDetailsOf(s));
  return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="facture_${invoiceNumber(o)}.pdf"` } });
}

const orderPatch = z.object({ status: z.enum(ADMIN_ORDER_STATUSES), notify: z.boolean().default(true) });
async function patchOrder(req: Request, id: string) {
  const { status, notify } = await body(req, orderPatch);
  const before = await prisma.order.findUnique({ where: { id }, select: { status: true } });
  const o = await adminSetOrderStatus(id, status);
  if (notify && before?.status !== status) await notifyOrderStatus(o.id, status);
  return json({ id: o.id, status: o.status });
}

/* ------------------------------------------------------------------------------------- Clients */

async function listCustomers(url: URL) {
  const { page, per, skip, take } = paging(url);
  const term = q(url);
  const where: Prisma.UserWhereInput = {
    NOT: { email: { endsWith: ANONYMIZED } },
    ...(term ? { OR: [{ email: { contains: term.toLowerCase() } }, ...caseVariants(term).map((v) => ({ name: { contains: v } }))] } : {}),
  };
  const [rows, total] = await Promise.all([prisma.user.findMany({ where, orderBy: { createdAt: "desc" }, skip, take, select: { id: true, name: true, email: true, role: true, createdAt: true, passwordHash: true } }), prisma.user.count({ where })]);
  const spent = await prisma.order.groupBy({ by: ["userId"], where: { userId: { in: rows.map((r) => r.id) }, status: { in: [...PAID] } }, _sum: { totalCents: true }, _count: { _all: true } });
  const byUser = new Map(spent.map((s) => [s.userId, s]));
  return list(
    rows.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.createdAt, login: u.passwordHash ? "email" : "google", orders: byUser.get(u.id)?._count._all ?? 0, spentCents: byUser.get(u.id)?._sum.totalCents ?? 0 })),
    total,
    page,
    per,
  );
}

async function getCustomer(id: string) {
  const u = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, createdAt: true, passwordHash: true, addresses: true, orders: { orderBy: { createdAt: "desc" }, select: { id: true, number: true, status: true, totalCents: true, createdAt: true } } },
  });
  if (!u) throw new ApiError(404, "Client introuvable");
  const { passwordHash, ...rest } = u;
  return json({ ...rest, login: passwordHash ? "email" : "google" });
}

/* ------------------------------------------------------------------------------------- Codes promo */

const couponSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,30}$/, "Code : 3 à 30 lettres, chiffres, tirets."),
  description: z.string().trim().max(200).default(""),
  type: z.enum(["POURCENTAGE", "MONTANT"]),
  value: z.number().int().positive("Valeur positive requise."),
  active: z.boolean().default(true),
  maxUses: z.number().int().positive().nullable().default(null),
  minOrderCents: z.number().int().min(0).default(0),
  expiresAt: z.string().datetime({ offset: true }).nullable().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).nullable().default(null),
  customerEmail: z.string().trim().toLowerCase().email().nullable().optional(),
});

async function couponData(input: z.infer<typeof couponSchema>) {
  if (input.type === "POURCENTAGE" && input.value > 100) throw new ApiError(400, "Un pourcentage ne peut pas dépasser 100.");
  let userId: string | null = null;
  if (input.customerEmail) {
    const u = await prisma.user.findUnique({ where: { email: input.customerEmail }, select: { id: true } });
    if (!u) throw new ApiError(404, "Aucun client avec cet email.");
    userId = u.id;
  }
  const expiresAt = input.expiresAt ? new Date(input.expiresAt.length === 10 ? `${input.expiresAt}T23:59:59` : input.expiresAt) : null;
  return { code: input.code, description: input.description, type: input.type, value: input.value, active: input.active, maxUses: input.maxUses, minOrderCents: input.minOrderCents, expiresAt, userId };
}

async function listCoupons() {
  const rows = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" }, include: { user: { select: { email: true } } } });
  return json({ items: rows.map(({ user, ...c }) => ({ ...c, customerEmail: user?.email ?? null })) });
}
async function createCoupon(req: Request) {
  const data = await couponData(await body(req, couponSchema));
  if (await prisma.coupon.findUnique({ where: { code: data.code } })) throw new ApiError(409, "Ce code existe déjà.");
  return json(await prisma.coupon.create({ data }), 201);
}
async function updateCoupon(req: Request, id: string) {
  const data = await couponData(await body(req, couponSchema));
  const clash = await prisma.coupon.findFirst({ where: { code: data.code, NOT: { id } } });
  if (clash) throw new ApiError(409, "Ce code existe déjà.");
  return json(await prisma.coupon.update({ where: { id }, data }));
}
async function deleteCoupon(id: string) {
  // Un code déjà utilisé reste dans l'historique des commandes : il est seulement désactivé.
  const used = await prisma.couponRedemption.count({ where: { couponId: id } });
  if (used) {
    await prisma.coupon.update({ where: { id }, data: { active: false } });
    return json({ id, deleted: false, deactivated: true });
  }
  await prisma.coupon.delete({ where: { id } });
  return json({ id, deleted: true });
}

/* ------------------------------------------------------------------------------------- Avis */

async function listReviews(url: URL) {
  const { page, per, skip, take } = paging(url);
  const [rows, total] = await Promise.all([
    prisma.review.findMany({ orderBy: { createdAt: "desc" }, skip, take, include: { user: { select: { name: true, email: true } }, product: { select: { titre: true, marque: true, slug: true } } } }),
    prisma.review.count(),
  ]);
  return list(
    rows.map((r) => ({ id: r.id, note: r.note, commentaire: r.commentaire, createdAt: r.createdAt, customer: r.user.name, email: r.user.email, product: `${r.product.marque} ${r.product.titre}`, productUrl: `${SITE_URL}/boutique/${r.product.slug}` })),
    total,
    page,
    per,
  );
}
async function deleteReview(id: string) {
  await prisma.review.delete({ where: { id } });
  invalidateCatalog();
  return json({ id, deleted: true });
}

/* ------------------------------------------------------------------------------------- Messages */

const KINDS = {
  contact: { statuses: ["NOUVEAU", "EN_COURS", "TRAITE"] },
  services: { statuses: ["NOUVEAU", "PLANIFIE", "TRAITE", "ANNULE"] },
  tickets: { statuses: ["OUVERT", "EN_COURS", "RESOLU", "FERME"] },
} as const;
type Kind = keyof typeof KINDS;
const asKind = (k: string | null): Kind => {
  if (k === "contact" || k === "services" || k === "tickets") return k;
  throw new ApiError(400, "Type de message inconnu");
};

async function listMessages(url: URL) {
  const kind = asKind(url.searchParams.get("kind"));
  const { page, per, skip, take } = paging(url);
  const status = url.searchParams.get("status") || undefined;
  const where = status ? { status } : {};
  const order = { createdAt: "desc" as const };
  if (kind === "contact") {
    const [items, total] = await Promise.all([prisma.contactMessage.findMany({ where, orderBy: order, skip, take }), prisma.contactMessage.count({ where })]);
    return list(items, total, page, per);
  }
  if (kind === "services") {
    const [items, total] = await Promise.all([prisma.serviceRequest.findMany({ where, orderBy: order, skip, take }), prisma.serviceRequest.count({ where })]);
    return list(items, total, page, per);
  }
  const [items, total] = await Promise.all([prisma.ticket.findMany({ where, orderBy: order, skip, take }), prisma.ticket.count({ where })]);
  return list(items, total, page, per);
}

const messagePatch = z.object({ status: z.string().trim().max(20) });
async function patchMessage(req: Request, kind: Kind, id: string) {
  const { status } = await body(req, messagePatch);
  if (!(KINDS[kind].statuses as readonly string[]).includes(status)) throw new ApiError(400, `Statut invalide (${KINDS[kind].statuses.join(", ")}).`);
  if (kind === "contact") await prisma.contactMessage.update({ where: { id }, data: { status } });
  else if (kind === "services") await prisma.serviceRequest.update({ where: { id }, data: { status } });
  else await prisma.ticket.update({ where: { id }, data: { status } });
  return json({ id, status });
}

const replySchema = z.object({ subject: z.string().trim().min(2).max(200), text: z.string().trim().min(2).max(10_000) });
async function replyMessage(req: Request, kind: Kind, id: string) {
  const { subject, text } = await body(req, replySchema);
  const row = kind === "contact" ? await prisma.contactMessage.findUnique({ where: { id } }) : kind === "services" ? await prisma.serviceRequest.findUnique({ where: { id } }) : await prisma.ticket.findUnique({ where: { id } });
  if (!row) throw new ApiError(404, "Message introuvable");
  const sent = await sendMail({ to: row.email, subject, text, tag: `reponse-${kind}` });
  const next = kind === "tickets" ? "EN_COURS" : "EN_COURS";
  if (row.status === "NOUVEAU" || row.status === "OUVERT") {
    if (kind === "contact") await prisma.contactMessage.update({ where: { id }, data: { status: next } });
    else if (kind === "services") await prisma.serviceRequest.update({ where: { id }, data: { status: "PLANIFIE" } });
    else await prisma.ticket.update({ where: { id }, data: { status: next } });
  }
  return json({ id, delivered: sent.delivered });
}

/* ------------------------------------------------------------------------------------- Newsletter */

async function listSubscribers(url: URL) {
  const { page, per, skip, take } = paging(url, 500);
  const term = q(url).toLowerCase();
  const where = term ? { email: { contains: term } } : {};
  const [items, total] = await Promise.all([prisma.newsletterSubscriber.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }), prisma.newsletterSubscriber.count({ where })]);
  return list(items, total, page, per);
}
async function exportSubscribers() {
  const rows = await prisma.newsletterSubscriber.findMany({ orderBy: { createdAt: "asc" } });
  const csv = ["email;source;inscription", ...rows.map((r) => `${r.email};${r.source};${r.createdAt.toISOString()}`)].join("\r\n");
  return new Response(`﻿${csv}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="newsletter.csv"' } });
}
async function deleteSubscriber(id: string) {
  await prisma.newsletterSubscriber.delete({ where: { id } });
  return json({ id, deleted: true });
}

const campaignSchema = z.object({ subject: z.string().trim().min(3).max(200), text: z.string().trim().min(10).max(20_000), testEmail: z.string().trim().toLowerCase().email().optional() });
async function sendCampaign(req: Request) {
  const { subject, text, testEmail } = await body(req, campaignSchema);
  if (testEmail) {
    const r = await sendMail(newsletterMessage(testEmail, `[Test] ${subject}`, text));
    return json({ test: true, recipients: 1, delivered: r.delivered });
  }
  const recipients = await prisma.newsletterSubscriber.findMany({ select: { email: true } });
  // Envoi en arrière-plan, par petits lots : la page d'administration répond tout de suite.
  void (async () => {
    for (let i = 0; i < recipients.length; i += 5) {
      await Promise.all(recipients.slice(i, i + 5).map((r) => sendMail(newsletterMessage(r.email, subject, text)).catch(() => null)));
    }
  })();
  return json({ test: false, recipients: recipients.length }, 202);
}

/* ------------------------------------------------------------------------------------- Stock */

async function listProducts(url: URL) {
  const { page, per, skip, take } = paging(url);
  const term = q(url);
  const low = url.searchParams.get("low") === "1";
  const where: Prisma.ProductWhereInput = {
    ...(low ? { stock: { lte: 1 } } : {}),
    ...(term ? { OR: [...caseVariants(term).map((v) => ({ titre: { contains: v } })), { marque: { contains: term.toUpperCase() } }, { modele: { contains: term.toUpperCase() } }] } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.product.findMany({ where, orderBy: low ? { stock: "asc" } : { updatedAt: "desc" }, skip, take, select: { id: true, slug: true, titre: true, marque: true, modele: true, stock: true, prixCents: true, promotionPrixCents: true } }),
    prisma.product.count({ where }),
  ]);
  return list(rows.map((p) => ({ ...p, url: `${SITE_URL}/boutique/${p.slug}` })), total, page, per);
}
async function getProduct(id: string) {
  const p = await prisma.product.findUnique({ where: { id }, select: { id: true, slug: true, stock: true, titre: true, updatedAt: true } });
  if (!p) throw new ApiError(404, "Produit introuvable sur le site (pas encore synchronisé ?)");
  const reserved = await prisma.orderItem.aggregate({ where: { productId: id, order: { status: "EN_ATTENTE_PAIEMENT" } }, _sum: { quantity: true } });
  return json({ ...p, reserved: reserved._sum.quantity ?? 0, url: `${SITE_URL}/boutique/${p.slug}` });
}
const stockSchema = z.object({ stock: z.number().int().min(0).max(100_000) });
async function patchProduct(req: Request, id: string) {
  const { stock } = await body(req, stockSchema);
  const p = await prisma.product.update({ where: { id }, data: { stock }, select: { id: true, stock: true } });
  invalidateCatalog();
  return json(p);
}

/* ------------------------------------------------------------------------------------- Routeur */

export async function handleAdmin(req: Request, segments: string[]): Promise<Response> {
  requireAdminKey(req);
  const url = new URL(req.url);
  const m = req.method;
  const [a, b, c, d] = segments;
  if (a === "ping" && m === "GET") return json({ ok: true, site: SITE_URL, smtp: await smtpConfigured(), time: new Date().toISOString() });
  if (a === "stats" && m === "GET") return stats();
  if (a === "export" && m === "GET") return exportForWordPress(url);
  if (a === "orders") {
    if (!b && m === "GET") return listOrders(url);
    if (b && c === "invoice" && m === "GET") return orderInvoice(b);
    if (b && !c && m === "GET") return getOrder(b);
    if (b && m === "PATCH") return patchOrder(req, b);
  }
  if (a === "customers") {
    if (!b && m === "GET") return listCustomers(url);
    if (b && m === "GET") return getCustomer(b);
  }
  if (a === "coupons") {
    if (!b && m === "GET") return listCoupons();
    if (!b && m === "POST") return createCoupon(req);
    if (b && m === "PUT") return updateCoupon(req, b);
    if (b && m === "DELETE") return deleteCoupon(b);
  }
  if (a === "reviews") {
    if (!b && m === "GET") return listReviews(url);
    if (b && m === "DELETE") return deleteReview(b);
  }
  if (a === "messages") {
    if (!b && m === "GET") return listMessages(url);
    if (b && c && !d && m === "PATCH") return patchMessage(req, asKind(b), c);
    if (b && c && d === "reply" && m === "POST") return replyMessage(req, asKind(b), c);
  }
  if (a === "newsletter") {
    if (!b && m === "GET") return listSubscribers(url);
    if (b === "export" && m === "GET") return exportSubscribers();
    if (b === "send" && m === "POST") return sendCampaign(req);
    if (b && m === "DELETE") return deleteSubscriber(b);
  }
  if (a === "products") {
    if (!b && m === "GET") return listProducts(url);
    if (b && m === "GET") return getProduct(b);
    if (b && m === "PATCH") return patchProduct(req, b);
  }
  throw new ApiError(404, "Route d'administration inconnue");
}
