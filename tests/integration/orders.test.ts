import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/server/api";
import {
  PENDING_TTL_MS,
  cancelPendingOrder,
  createOrder,
  expireStaleOrders,
  getUserOrder,
  markOrderPaid,
  quoteOrder,
  recordPaymentFailure,
  toOrderDTO,
} from "@/lib/server/orders";
import { ADDRESS, geocoderAt, makeProduct, makeUser, orderRequest, resetDb } from "../support/fixtures";

const stockOf = async (id: string) => (await prisma.product.findUniqueOrThrow({ where: { id } })).stock;

async function expectApiError(p: Promise<unknown>, status: number, message?: RegExp) {
  const e = await p.then(
    () => null,
    (err: unknown) => err,
  );
  expect(e, "une ApiError était attendue").toBeInstanceOf(ApiError);
  expect((e as ApiError).status).toBe(status);
  if (message) expect((e as ApiError).message).toMatch(message);
  return e as ApiError;
}

beforeEach(resetDb);

describe("devis serveur (quoteOrder)", () => {
  it("prix promotionnel prioritaire, quantités fusionnées", async () => {
    const user = await makeUser();
    const p = await makeProduct({ prixCents: 50_000, promotionPrixCents: 45_000 });
    const q = await quoteOrder(prisma, user.id, orderRequest([{ _id: p.id, quantity: 1 }, { _id: p.id, quantity: 1 }], 0));
    expect(q.lines).toHaveLength(1);
    expect(q.lines[0]).toMatchObject({ quantity: 2, unitPriceCents: 45_000, originalPriceCents: 50_000 });
    expect(q.subtotalCents).toBe(90_000);
    expect(q.totalCents).toBe(90_000);
    expect(q.deliveryFeeCents).toBe(0);
  });

  it("livraison offerte : installation, reprise et étage sans frais", async () => {
    const user = await makeUser();
    const p = await makeProduct({ caracteristiques: { poids: 30 } });
    const q = await quoteOrder(
      prisma,
      user.id,
      orderRequest([{ _id: p.id, quantity: 1 }], 0, {
        isPickupInStore: false,
        deliveryMethod: "installation",
        includeOldItemPickup: true,
        shippingAddress: { ...ADDRESS, floor: 4 },
      }),
      { distanceKm: 10 },
    );
    expect(q.deliveryFeeCents).toBe(0);
    expect(q.totalCents).toBe(50_000);
  });

  it("distance calculée côté serveur via le géocodeur", async () => {
    const user = await makeUser();
    const p = await makeProduct();
    const req = orderRequest([{ _id: p.id, quantity: 1 }], 0, { isPickupInStore: false, deliveryMethod: "piedDuCamion", shippingAddress: ADDRESS });
    const q = await quoteOrder(prisma, user.id, req, { geocoder: geocoderAt(30) });
    expect(q.deliveryDistanceKm).toBe(30);
    expect(q.deliveryFeeCents).toBe(0);
  });

  it("livraison partout en France, tous modes, sans limite de distance", async () => {
    const user = await makeUser();
    const p = await makeProduct();
    const req = (deliveryMethod: "piedDuCamion" | "installation") =>
      orderRequest([{ _id: p.id, quantity: 1 }], 0, { isPickupInStore: false, deliveryMethod, shippingAddress: ADDRESS });
    // Sevran -> Marseille ≈ 660 km, Sevran -> Ajaccio ≈ 920 km
    for (const distanceKm of [81, 660, 920]) {
      const q = await quoteOrder(prisma, user.id, req("installation"), { distanceKm });
      expect(q.deliveryFeeCents).toBe(0);
      expect(q.deliveryDistanceKm).toBe(distanceKm);
    }
  });

  it("adresse introuvable -> 422", async () => {
    const user = await makeUser();
    const p = await makeProduct();
    const req = orderRequest([{ _id: p.id, quantity: 1 }], 0, { isPickupInStore: false, deliveryMethod: "piedDuCamion", shippingAddress: ADDRESS });
    await expectApiError(quoteOrder(prisma, user.id, req, { geocoder: async () => null }), 422, /distance/);
  });

  it("produit inconnu -> 404, rupture -> 409 avec le stock disponible", async () => {
    const user = await makeUser();
    const p = await makeProduct({ stock: 1 });
    await expectApiError(quoteOrder(prisma, user.id, orderRequest([{ _id: "inconnu", quantity: 1 }], 0)), 404);
    const e = await expectApiError(quoteOrder(prisma, user.id, orderRequest([{ _id: p.id, quantity: 2 }], 0)), 409, /1 disponible/);
    expect(e.details).toEqual({ productId: p.id, available: 1 });
  });
});

describe("création de commande", () => {
  it("réserve le stock et crée une commande en attente de paiement", async () => {
    const user = await makeUser();
    const p = await makeProduct({ stock: 3 });
    const { order } = await createOrder(user.id, orderRequest([{ _id: p.id, quantity: 2 }], 1000));
    expect(order.status).toBe("EN_ATTENTE_PAIEMENT");
    expect(order.number).toMatch(/^TAT-\d{8}-[0-9A-F]{6}$/);
    expect(order.totalCents).toBe(100_000);
    expect(order.items).toHaveLength(1);
    expect(await stockOf(p.id)).toBe(1);
    const dto = toOrderDTO(await getUserOrder(user.id, order.id));
    expect(dto).toMatchObject({ totalAmount: 1000, subtotal: 1000, isPickupInStore: true, status: "EN_ATTENTE_PAIEMENT" });
    expect(new Date(dto.expiresAt!).getTime() - new Date(dto.createdAt).getTime()).toBe(PENDING_TTL_MS);
  });

  it("total affiché différent du total serveur -> 409, rien n'est réservé", async () => {
    const user = await makeUser();
    const p = await makeProduct({ stock: 3 });
    const e = await expectApiError(createOrder(user.id, orderRequest([{ _id: p.id, quantity: 1 }], 1)), 409, /recalculé/);
    expect(e.details).toEqual({ totalAmount: 500 });
    expect(await stockOf(p.id)).toBe(3);
    expect(await prisma.order.count()).toBe(0);
  });

  it("une nouvelle commande annule la précédente commande impayée et libère son stock", async () => {
    const user = await makeUser();
    const a = await makeProduct({ stock: 1 });
    const first = await createOrder(user.id, orderRequest([{ _id: a.id, quantity: 1 }], 500));
    expect(await stockOf(a.id)).toBe(0);
    const second = await createOrder(user.id, orderRequest([{ _id: a.id, quantity: 1 }], 500));
    expect((await prisma.order.findUniqueOrThrow({ where: { id: first.order.id } })).status).toBe("ANNULEE");
    expect(second.order.status).toBe("EN_ATTENTE_PAIEMENT");
    expect(await stockOf(a.id)).toBe(0);
  });

  it("deux clients, un seul article : le second est refusé", async () => {
    const [u1, u2] = [await makeUser(), await makeUser()];
    const p = await makeProduct({ stock: 1 });
    await createOrder(u1.id, orderRequest([{ _id: p.id, quantity: 1 }], 500));
    await expectApiError(createOrder(u2.id, orderRequest([{ _id: p.id, quantity: 1 }], 500)), 409, /rupture/);
    expect(await stockOf(p.id)).toBe(0);
  });

  it("livraison : géocodage, frais et adresse enregistrés", async () => {
    const user = await makeUser();
    const p = await makeProduct();
    const { order } = await createOrder(
      user.id,
      orderRequest([{ _id: p.id, quantity: 1 }], 500, { isPickupInStore: false, deliveryMethod: "livraisonPiece", shippingAddress: ADDRESS }),
      geocoderAt(15),
    );
    expect(order).toMatchObject({ deliveryFeeCents: 0, deliveryDistanceKm: 15, deliveryMethod: "livraisonPiece", isPickupInStore: false });
    expect(order.shippingAddress).toMatchObject({ city: "Sevran", postalCode: "93270" });
  });
});

describe("cycle de vie", () => {
  it("les commandes impayées expirent après 30 min et rendent le stock", async () => {
    const user = await makeUser();
    const p = await makeProduct({ stock: 2 });
    const { order } = await createOrder(user.id, orderRequest([{ _id: p.id, quantity: 2 }], 1000));
    await prisma.order.update({ where: { id: order.id }, data: { createdAt: new Date(Date.now() - PENDING_TTL_MS - 1000) } });
    expect(await expireStaleOrders()).toBe(1);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("ANNULEE");
    expect(await stockOf(p.id)).toBe(2);
    expect(await expireStaleOrders()).toBe(0);
  });

  it("annulation : réservée au propriétaire, une seule fois", async () => {
    const [owner, other] = [await makeUser(), await makeUser()];
    const p = await makeProduct({ stock: 1 });
    const { order } = await createOrder(owner.id, orderRequest([{ _id: p.id, quantity: 1 }], 500));
    await expectApiError(cancelPendingOrder(other.id, order.id), 404);
    await cancelPendingOrder(owner.id, order.id);
    expect(await stockOf(p.id)).toBe(1);
    await expectApiError(cancelPendingOrder(owner.id, order.id), 409);
    expect(await stockOf(p.id)).toBe(1);
  });

  it("une commande d'un autre client est introuvable", async () => {
    const [owner, other] = [await makeUser(), await makeUser()];
    const p = await makeProduct();
    const { order } = await createOrder(owner.id, orderRequest([{ _id: p.id, quantity: 1 }], 500));
    await expectApiError(getUserOrder(other.id, order.id), 404);
  });

  it("paiement : idempotent, coupon consommé une seule fois", async () => {
    const user = await makeUser();
    const p = await makeProduct({ prixCents: 100_000 });
    await prisma.coupon.create({ data: { code: "BIENVENUE10", type: "POURCENTAGE", value: 10 } });
    const { order } = await createOrder(user.id, orderRequest([{ _id: p.id, quantity: 1 }], 900, { couponCode: "bienvenue10" }));
    expect(order).toMatchObject({ discountCents: 10_000, totalCents: 90_000, couponCode: "BIENVENUE10" });

    const pay = { provider: "test", mode: "test" as const, providerRef: `test_${order.id}` };
    const paid = await markOrderPaid(order.id, pay);
    expect(paid.status).toBe("PAYEE");
    expect(paid.paidAt).toBeInstanceOf(Date);
    await markOrderPaid(order.id, pay);

    expect(await prisma.payment.count({ where: { orderId: order.id, status: "REUSSI" } })).toBe(1);
    expect((await prisma.payment.findFirstOrThrow({ where: { orderId: order.id } })).amountCents).toBe(90_000);
    expect(await prisma.couponRedemption.count()).toBe(1);
    expect((await prisma.coupon.findUniqueOrThrow({ where: { code: "BIENVENUE10" } })).usedCount).toBe(1);
    // Le coupon ne peut plus être réutilisé par ce client.
    await expectApiError(createOrder(user.id, orderRequest([{ _id: p.id, quantity: 1 }], 900, { couponCode: "BIENVENUE10" })), 409, /déjà utilisé/);
  });

  it("paiement reçu après expiration : le stock est réservé à nouveau", async () => {
    const user = await makeUser();
    const p = await makeProduct({ stock: 1 });
    const { order } = await createOrder(user.id, orderRequest([{ _id: p.id, quantity: 1 }], 500));
    await cancelPendingOrder(user.id, order.id);
    expect(await stockOf(p.id)).toBe(1);
    expect((await markOrderPaid(order.id, { provider: "test", mode: "test", providerRef: "late" })).status).toBe("PAYEE");
    expect(await stockOf(p.id)).toBe(0);
  });

  it("paiement refusé : historisé, la commande reste payable", async () => {
    const user = await makeUser();
    const p = await makeProduct();
    const { order } = await createOrder(user.id, orderRequest([{ _id: p.id, quantity: 1 }], 500));
    await recordPaymentFailure(order.id, { provider: "test", mode: "test", providerRef: "fail", reason: "Carte refusée" });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("EN_ATTENTE_PAIEMENT");
    expect(await prisma.payment.findFirstOrThrow({ where: { orderId: order.id } })).toMatchObject({ status: "ECHOUE", details: { reason: "Carte refusée" } });
  });
});
