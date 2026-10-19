import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { OrderRequest } from "@/lib/server/orders";

/** Vide toutes les tables (ordre compatible avec les clés étrangères). */
export async function resetDb() {
  await prisma.$transaction([
    prisma.couponRedemption.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
    prisma.review.deleteMany(),
    prisma.address.deleteMany(),
    prisma.passwordResetToken.deleteMany(),
    prisma.ticket.deleteMany(),
    prisma.coupon.deleteMany(),
    prisma.productImage.deleteMany(),
    prisma.product.deleteMany(),
    prisma.category.deleteMany(),
    prisma.contactMessage.deleteMany(),
    prisma.serviceRequest.deleteMany(),
    prisma.newsletterSubscriber.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

let seq = 0;
const hex24 = () => (Date.now().toString(16) + (++seq).toString(16).padStart(6, "0")).padStart(24, "0").slice(-24);

export async function makeCategory(nom = "lave-linge") {
  return prisma.category.upsert({ where: { slug: nom }, update: {}, create: { slug: nom, nom } });
}

export async function makeProduct(overrides: Partial<Prisma.ProductUncheckedCreateInput> = {}) {
  const cat = await makeCategory();
  const id = overrides.id ?? hex24();
  return prisma.product.create({
    data: {
      id,
      slug: `produit-${id}`,
      titre: `PRODUIT ${id.slice(-4)}`,
      marque: "MARQUE",
      modele: "M1",
      prixCents: 50000,
      stock: 5,
      categoryId: cat.id,
      sousCategories: [],
      caracteristiques: { poids: 10 },
      couleurs: [],
      ...overrides,
    },
  });
}

export async function makeUser(email = `client-${++seq}@tatos.test`) {
  return prisma.user.create({ data: { email, name: email.split("@")[0] } });
}

export const ADDRESS = {
  fullName: "Jean Test",
  address: "1 Rue de Test",
  city: "Sevran",
  postalCode: "93270",
  phone: "0612345678",
  additionalInfo: "",
  floor: 0,
};

/** Requête de commande (retrait magasin par défaut). */
export function orderRequest(items: { _id: string; quantity: number }[], totalEuros: number, extra: Partial<OrderRequest> = {}): OrderRequest {
  return {
    items,
    totalAmount: totalEuros,
    deliveryMethod: null,
    includeOldItemPickup: false,
    isPickupInStore: true,
    shippingAddress: null,
    couponCode: null,
    ...extra,
  };
}

/** Géocodeur factice : coordonnées à `km` kilomètres environ au nord du magasin. */
export const geocoderAt = (km: number) => async () => ({ lat: 48.9325 + km / 111.195, lng: 2.533 });
