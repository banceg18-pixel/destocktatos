import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/server/api";
import { createAddress, deleteAddress, getAddress, listAddresses, setDefaultAddress, updateAddress } from "@/lib/server/addresses";
import { evaluateCoupon } from "@/lib/server/coupons";
import { createOrder, markOrderPaid } from "@/lib/server/orders";
import { canUserReview, createReview, deleteReview, listReviews, updateReview } from "@/lib/server/reviews";
import { addressSchema } from "@/lib/validation";
import { ADDRESS, makeProduct, makeUser, orderRequest, resetDb } from "../support/fixtures";

async function status(p: Promise<unknown>) {
  try {
    await p;
    return 200;
  } catch (e) {
    if (e instanceof ApiError) return e.status;
    throw e;
  }
}

beforeEach(resetDb);

describe("coupons", () => {
  it("codes invalides, expirés, personnels, épuisés, minimum de commande", async () => {
    const [user, other] = [await makeUser(), await makeUser()];
    await prisma.coupon.createMany({
      data: [
        { code: "INACTIF", type: "POURCENTAGE", value: 10, active: false },
        { code: "EXPIRE", type: "POURCENTAGE", value: 10, expiresAt: new Date(Date.now() - 1000) },
        { code: "PERSO", type: "MONTANT", value: 2_000, userId: other.id },
        { code: "EPUISE", type: "POURCENTAGE", value: 10, maxUses: 1, usedCount: 1 },
        { code: "MINI", type: "POURCENTAGE", value: 10, minOrderCents: 50_000 },
      ],
    });
    expect(await status(evaluateCoupon(prisma, user.id, "  ", 10_000))).toBe(400);
    expect(await status(evaluateCoupon(prisma, user.id, "NEXISTEPAS", 10_000))).toBe(404);
    expect(await status(evaluateCoupon(prisma, user.id, "INACTIF", 10_000))).toBe(404);
    expect(await status(evaluateCoupon(prisma, user.id, "EXPIRE", 10_000))).toBe(410);
    expect(await status(evaluateCoupon(prisma, user.id, "PERSO", 10_000))).toBe(403);
    expect(await status(evaluateCoupon(prisma, user.id, "EPUISE", 10_000))).toBe(410);
    expect(await status(evaluateCoupon(prisma, user.id, "MINI", 10_000))).toBe(400);
    const ok = await evaluateCoupon(prisma, other.id, "perso", 100_000);
    expect(ok.discountCents).toBe(2_000);
  });
});

describe("avis clients", () => {
  it("réservés aux acheteurs (commande payée), un seul avis par produit", async () => {
    const [buyer, visitor] = [await makeUser(), await makeUser()];
    const p = await makeProduct();
    expect((await canUserReview(buyer.id, p.id)).ok).toBe(false);

    const { order } = await createOrder(buyer.id, orderRequest([{ _id: p.id, quantity: 1 }], 500));
    // Commande non payée : pas encore d'avis possible.
    expect((await canUserReview(buyer.id, p.id)).ok).toBe(false);
    await markOrderPaid(order.id, { provider: "test", mode: "test", providerRef: "r" });
    expect(await canUserReview(buyer.id, p.id)).toEqual({ ok: true });

    const review = await createReview(buyer.id, p.id, 5, "Très bien");
    expect(review).toMatchObject({ note: 5, commentaire: "Très bien", utilisateur: { _id: buyer.id } });
    expect(await status(createReview(buyer.id, p.id, 4, "Encore"))).toBe(409);
    expect(await status(createReview(visitor.id, p.id, 1, "Jamais acheté"))).toBe(403);
    expect(await status(createReview(buyer.id, "inconnu", 5, ""))).toBe(404);

    expect(await status(updateReview(visitor.id, review._id, 1, "pirate"))).toBe(403);
    expect((await updateReview(buyer.id, review._id, 4, "Bien")).note).toBe(4);
    expect(await listReviews(p.id)).toHaveLength(1);
    expect(await status(deleteReview(visitor.id, review._id))).toBe(403);
    await deleteReview(buyer.id, review._id);
    expect(await listReviews(p.id)).toHaveLength(0);
    expect(await status(deleteReview(buyer.id, review._id))).toBe(404);
  });
});

describe("carnet d'adresses", () => {
  const input = (over: Partial<typeof ADDRESS & { isDefault: boolean }> = {}) => addressSchema.parse({ ...ADDRESS, ...over });

  it("adresse par défaut unique, promotion de la suivante à la suppression", async () => {
    const [user, other] = [await makeUser(), await makeUser()];
    const a = await createAddress(user.id, input({ fullName: "A" }));
    expect(a.isDefault).toBe(true); // la première adresse devient l'adresse par défaut
    const b = await createAddress(user.id, input({ fullName: "B" }));
    expect(b.isDefault).toBe(false);
    const c = await createAddress(user.id, input({ fullName: "C", isDefault: true }));
    expect((await listAddresses(user.id)).filter((x) => x.isDefault).map((x) => x.fullName)).toEqual(["C"]);

    await setDefaultAddress(user.id, b._id);
    expect((await listAddresses(user.id))[0]).toMatchObject({ fullName: "B", isDefault: true });

    await updateAddress(user.id, b._id, input({ fullName: "B2", floor: 3 }));
    expect(await getAddress(user.id, b._id)).toMatchObject({ fullName: "B2", floor: 3, isDefault: true });

    await deleteAddress(user.id, b._id);
    const left = await listAddresses(user.id);
    expect(left.map((x) => x.fullName).sort()).toEqual(["A", "C"]);
    expect(left.filter((x) => x.isDefault)).toHaveLength(1);

    // Les adresses d'un autre client sont invisibles (404, pas 403).
    expect(await status(getAddress(other.id, a._id))).toBe(404);
    expect(await status(updateAddress(other.id, a._id, input()))).toBe(404);
    expect(await status(deleteAddress(other.id, c._id))).toBe(404);
    expect(await status(setDefaultAddress(other.id, c._id))).toBe(404);
  });

  it("maximum 10 adresses", async () => {
    const user = await makeUser();
    for (let i = 0; i < 10; i++) await createAddress(user.id, input({ fullName: `N${i}` }));
    expect(await status(createAddress(user.id, input()))).toBe(400);
  });
});
