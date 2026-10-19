import "server-only";
import { prisma } from "@/lib/prisma";
import { invalidateCatalog } from "@/lib/catalog/repository";
import { ApiError } from "./api";

/** Statuts de commande qui prouvent un achat (avis « vérifiés »). */
export const PURCHASED_STATUSES = ["PAYEE", "EN_PREPARATION", "EXPEDIEE", "LIVREE"] as const;

export function toReviewDTO(r: { id: string; note: number; commentaire: string; createdAt: Date; user: { id: string; name: string; image: string | null } }) {
  return {
    _id: r.id,
    note: r.note,
    commentaire: r.commentaire,
    dateCreation: r.createdAt.toISOString(),
    utilisateur: { _id: r.user.id, name: r.user.name, image: r.user.image },
  };
}

export async function listReviews(productId: string) {
  const rows = await prisma.review.findMany({
    where: { productId },
    include: { user: { select: { id: true, name: true, image: true } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toReviewDTO);
}

/** Un client peut noter un produit qu'il a acheté (commande payée) et qu'il n'a pas encore noté. */
export async function canUserReview(userId: string, productId: string): Promise<{ ok: boolean; raison?: string }> {
  const existing = await prisma.review.findUnique({ where: { productId_userId: { productId, userId } } });
  if (existing) return { ok: false, raison: "Vous avez déjà donné votre avis sur ce produit" };
  const bought = await prisma.orderItem.findFirst({
    where: { productId, order: { userId, status: { in: [...PURCHASED_STATUSES] } } },
    select: { id: true },
  });
  if (!bought) return { ok: false, raison: "Seuls les clients ayant acheté ce produit peuvent laisser un avis" };
  return { ok: true };
}

export async function createReview(userId: string, productId: string, note: number, commentaire: string) {
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!product) throw new ApiError(404, "Produit introuvable");
  const check = await canUserReview(userId, productId);
  if (!check.ok) throw new ApiError(check.raison?.startsWith("Vous avez déjà") ? 409 : 403, check.raison!);
  const r = await prisma.review.create({
    data: { productId, userId, note, commentaire },
    include: { user: { select: { id: true, name: true, image: true } } },
  });
  invalidateCatalog();
  return toReviewDTO(r);
}

async function ownReview(userId: string, id: string) {
  const review = await prisma.review.findUnique({ where: { id } });
  if (!review) throw new ApiError(404, "Avis introuvable");
  if (review.userId !== userId) throw new ApiError(403, "Vous ne pouvez modifier que vos propres avis");
  return review;
}

export async function updateReview(userId: string, id: string, note: number, commentaire: string) {
  await ownReview(userId, id);
  const r = await prisma.review.update({
    where: { id },
    data: { note, commentaire },
    include: { user: { select: { id: true, name: true, image: true } } },
  });
  invalidateCatalog();
  return toReviewDTO(r);
}

export async function deleteReview(userId: string, id: string) {
  await ownReview(userId, id);
  await prisma.review.delete({ where: { id } });
  invalidateCatalog();
}
