import fs from "node:fs";
import bcrypt from "bcryptjs";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { invalidateCatalog } from "@/lib/catalog/repository";
import { resetRateLimits } from "@/lib/server/rate-limit";
import { makeProduct, makeUser, resetDb } from "../support/fixtures";

// Session simulée pour les routes de l'espace client.
const auth = vi.hoisted(() => ({ user: null as null | { id: string; role: string; email?: string } }));
vi.mock("@/lib/auth", () => ({
  getSession: async () => (auth.user ? { user: auth.user } : null),
  isGoogleEnabled: () => false,
  authOptions: {},
}));

const { handleAdmin } = await import("@/lib/server/admin");
const { handleError } = await import("@/lib/server/api");
const { markOrderPaid } = await import("@/lib/server/orders");
const { unsubscribeToken } = await import("@/lib/server/notifications");
const me = await import("@/app/api/users/me/route");
const password = await import("@/app/api/users/me/password/route");
const unsubscribe = await import("@/app/api/newsletter/unsubscribe/route");

const KEY = "cle-de-test-administration";
const outbox = process.env.MAIL_OUTBOX_DIR!;
const mails = (tag: string) => (fs.existsSync(outbox) ? fs.readdirSync(outbox).filter((f) => f.endsWith(`-${tag}.json`)) : []);
const flush = () => new Promise((r) => setTimeout(r, 150)); // notifications envoyées sans attendre
/** Attend qu'un envoi en arrière-plan ait produit `count` emails (3 s au plus). */
async function waitForMails(tag: string, count: number) {
  for (let i = 0; i < 60 && mails(tag).length < count; i++) await new Promise((r) => setTimeout(r, 50));
  return mails(tag);
}

/** Appel de l'API d'administration, comme le fait le plugin WordPress. */
async function admin(method: string, path: string, body?: unknown, key = KEY) {
  const req = new Request(`http://localhost/api/admin/${path}`, {
    method,
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-forwarded-for": "10.9.9.9" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  try {
    return await handleAdmin(req, path.split("?")[0].split("/"));
  } catch (e) {
    return handleError(e, "test");
  }
}
const json = (method: string, body?: unknown) => new Request("http://localhost/api", { method, headers: { "content-type": "application/json", "x-forwarded-for": "10.8.8.8" }, body: body === undefined ? undefined : JSON.stringify(body) });

async function paidOrder(stock = 5, quantity = 1) {
  const user = await makeUser();
  const p = await makeProduct({ stock: stock - quantity });
  const order = await prisma.order.create({
    data: {
      number: `TAT-TEST-${Math.random().toString(16).slice(2, 8).toUpperCase()}`,
      userId: user.id,
      subtotalCents: p.prixCents * quantity,
      totalCents: p.prixCents * quantity,
      isPickupInStore: true,
      items: { create: [{ productId: p.id, titre: p.titre, marque: p.marque, unitPriceCents: p.prixCents, quantity, lineTotalCents: p.prixCents * quantity }] },
    },
  });
  await markOrderPaid(order.id, { provider: "test", mode: "test", providerRef: `test-${order.id}` });
  return { user, product: p, order };
}

beforeAll(() => {
  process.env.ADMIN_API_SECRET = KEY;
});
afterAll(() => {
  delete process.env.ADMIN_API_SECRET;
});
beforeEach(async () => {
  await resetDb();
  invalidateCatalog();
  resetRateLimits();
  auth.user = null;
  fs.rmSync(outbox, { recursive: true, force: true });
});

describe("API d'administration (espace WordPress)", () => {
  it("refuse tout appel sans la bonne clé ; indisponible si la clé n'est pas configurée", async () => {
    expect((await admin("GET", "ping", undefined, "mauvaise-cle")).status).toBe(401);
    expect((await admin("GET", "ping", undefined, "")).status).toBe(401);
    expect((await admin("GET", "ping")).status).toBe(200);
    delete process.env.ADMIN_API_SECRET;
    expect((await admin("GET", "ping")).status).toBe(503);
    process.env.ADMIN_API_SECRET = KEY;
  });

  it("commande payée : confirmation au client et au magasin, puis suivi de statut par le magasin", async () => {
    const { order } = await paidOrder();
    expect(await waitForMails("commande-confirmation", 1)).toHaveLength(1);
    expect(await waitForMails("commande-magasin", 1)).toHaveLength(1);
    // Une seconde confirmation (webhook Stripe + page de retour) n'envoie pas de doublon.
    await markOrderPaid(order.id, { provider: "test", mode: "test", providerRef: `test-${order.id}` });
    await flush();
    expect(mails("commande-confirmation")).toHaveLength(1);

    const list = await (await admin("GET", "orders")).json();
    expect(list.items.map((o: { number: string }) => o.number)).toContain(order.number);
    const res = await admin("PATCH", `orders/${order.id}`, { status: "EXPEDIEE", notify: true });
    expect(res.status).toBe(200);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("EXPEDIEE");
    expect(mails("commande-expediee")).toHaveLength(1);
    const pdf = await admin("GET", `orders/${order.id}/invoice`);
    expect(pdf.headers.get("content-type")).toBe("application/pdf");
  });

  it("annulation : stock rendu, statut figé ensuite ; une commande non payée ne peut pas être expédiée", async () => {
    const { order, product } = await paidOrder(5, 2);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(3);
    expect((await admin("PATCH", `orders/${order.id}`, { status: "ANNULEE", notify: false })).status).toBe(200);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(5);
    expect((await admin("PATCH", `orders/${order.id}`, { status: "LIVREE" })).status).toBe(409);
    expect((await admin("PATCH", `orders/${order.id}`, { status: "PAYEE" })).status).toBe(400);

    const user = await makeUser();
    const p = await makeProduct();
    const pending = await prisma.order.create({ data: { number: "TAT-TEST-PENDING", userId: user.id, subtotalCents: 100, totalCents: 100, items: { create: [{ productId: p.id, titre: p.titre, marque: p.marque, unitPriceCents: 100, quantity: 1, lineTotalCents: 100 }] } } });
    expect((await admin("PATCH", `orders/${pending.id}`, { status: "EN_PREPARATION" })).status).toBe(409);
  });

  it("codes promo : création, doublon, valeur invalide ; un code déjà utilisé est désactivé plutôt que supprimé", async () => {
    const created = await admin("POST", "coupons", { code: "ete10", type: "POURCENTAGE", value: 10, description: "Été" });
    expect(created.status).toBe(201);
    const coupon = await created.json();
    expect(coupon.code).toBe("ETE10");
    expect((await admin("POST", "coupons", { code: "ETE10", type: "POURCENTAGE", value: 5 })).status).toBe(409);
    expect((await admin("POST", "coupons", { code: "TROP", type: "POURCENTAGE", value: 150 })).status).toBe(400);
    const { user, order } = await paidOrder();
    await prisma.couponRedemption.create({ data: { couponId: coupon.id, userId: user.id, orderId: order.id, discountCents: 100 } });
    const del = await (await admin("DELETE", `coupons/${coupon.id}`)).json();
    expect(del).toMatchObject({ deleted: false, deactivated: true });
    expect((await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } })).active).toBe(false);
  });

  it("stock, messages, avis et newsletter", async () => {
    const p = await makeProduct({ stock: 2 });
    expect((await admin("PATCH", `products/${p.id}`, { stock: 9 })).status).toBe(200);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).stock).toBe(9);
    expect((await admin("PATCH", `products/${p.id}`, { stock: -1 })).status).toBe(400);

    const msg = await prisma.contactMessage.create({ data: { name: "Client", email: "client@tatos.test", message: "Bonjour" } });
    expect((await admin("PATCH", `messages/contact/${msg.id}`, { status: "INCONNU" })).status).toBe(400);
    expect((await admin("POST", `messages/contact/${msg.id}/reply`, { subject: "Re : votre question", text: "Bonjour, voici la réponse." })).status).toBe(200);
    expect((await prisma.contactMessage.findUniqueOrThrow({ where: { id: msg.id } })).status).toBe("EN_COURS");
    expect(mails("reponse-contact")).toHaveLength(1);

    await prisma.newsletterSubscriber.createMany({ data: [{ email: "a@tatos.test" }, { email: "b@tatos.test" }] });
    const csv = await (await admin("GET", "newsletter/export")).text();
    expect(csv).toContain("a@tatos.test");
    const sent = await (await admin("POST", "newsletter/send", { subject: "Offres de juin", text: "Toutes nos offres du mois de juin." })).json();
    expect(sent.recipients).toBe(2);
    expect(await waitForMails("newsletter", 2)).toHaveLength(2);
    const mail = JSON.parse(fs.readFileSync(`${outbox}/${mails("newsletter")[0]}`, "utf8"));
    expect(mail.text).toMatch(/newsletter\/desinscription\?email=.+&token=[a-f0-9]{32}/);
  });
});

describe("newsletter : désinscription signée", () => {
  it("lien valide accepté, lien falsifié refusé", async () => {
    await prisma.newsletterSubscriber.create({ data: { email: "lecteur@tatos.test" } });
    expect((await unsubscribe.POST(json("POST", { email: "lecteur@tatos.test", token: "0".repeat(32) }))).status).toBe(400);
    expect((await unsubscribe.POST(json("POST", { email: "lecteur@tatos.test", token: unsubscribeToken("lecteur@tatos.test") }))).status).toBe(200);
    expect(await prisma.newsletterSubscriber.count()).toBe(0);
  });
});

describe("espace client : profil", () => {
  it("nom modifiable ; mot de passe changé seulement avec l'actuel ; création pour un compte Google", async () => {
    const user = await prisma.user.create({ data: { email: "profil@tatos.test", name: "Avant", passwordHash: await bcrypt.hash("Ancien2026", 4) } });
    auth.user = { id: user.id, role: "CUSTOMER" };
    expect((await me.PATCH(json("PATCH", { name: "Après Modification" }))).status).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).name).toBe("Après Modification");
    expect((await password.POST(json("POST", { current: "mauvais", mdp: "Nouveau2026", mdpv: "Nouveau2026" }))).status).toBe(400);
    expect((await password.POST(json("POST", { current: "Ancien2026", mdp: "Nouveau2026", mdpv: "Nouveau2026" }))).status).toBe(200);
    expect(await bcrypt.compare("Nouveau2026", (await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).passwordHash!)).toBe(true);

    const google = await prisma.user.create({ data: { email: "google@gmail.test", name: "Google" } });
    auth.user = { id: google.id, role: "CUSTOMER" };
    expect((await password.POST(json("POST", { mdp: "Premier2026", mdpv: "Premier2026" }))).status).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: google.id } })).passwordHash).not.toBeNull();
  });

  it("suppression du compte : confirmation exigée, données anonymisées, commandes conservées", async () => {
    const { user, order } = await paidOrder();
    auth.user = { id: user.id, role: "CUSTOMER" };
    expect((await me.DELETE(json("DELETE", { confirm: "oui" }))).status).toBe(400);
    // Commande payée non livrée : suppression refusée tant que la livraison n'est pas faite.
    expect((await me.DELETE(json("DELETE", { confirm: "SUPPRIMER" }))).status).toBe(409);
    await prisma.order.update({ where: { id: order.id }, data: { status: "LIVREE" } });
    expect((await me.DELETE(json("DELETE", { confirm: "SUPPRIMER" }))).status).toBe(200);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.email).toMatch(/@compte-supprime\.invalid$/);
    expect(after.passwordHash).toBeNull();
    expect(await prisma.order.count({ where: { userId: user.id } })).toBe(1);
  });
});
