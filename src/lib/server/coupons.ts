import "server-only";
import type { Coupon, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { COUPON_MAX_RATIO } from "@/lib/delivery";
import { ApiError } from "./api";

type Db = Prisma.TransactionClient | typeof prisma;

const fmt = (cents: number) => (cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Vérifie un coupon pour un client et un sous-total donnés et calcule la réduction (centimes).
 * Règle visible sur la source : la réduction est plafonnée à 10 % du montant de la commande.
 */
export async function evaluateCoupon(db: Db, userId: string, rawCode: string, subtotalCents: number) {
  const code = rawCode.trim().toUpperCase();
  if (!code) throw new ApiError(400, "Veuillez saisir un code de coupon");
  const coupon = await db.coupon.findUnique({ where: { code } });
  if (!coupon || !coupon.active) throw new ApiError(404, "Code coupon invalide");
  if (coupon.expiresAt && coupon.expiresAt < new Date()) throw new ApiError(410, "Ce code coupon a expiré");
  if (coupon.userId && coupon.userId !== userId) throw new ApiError(403, "Ce code coupon n'est pas valable pour votre compte");
  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) throw new ApiError(410, "Ce code coupon a déjà été utilisé");
  const already = await db.couponRedemption.findFirst({ where: { couponId: coupon.id, userId } });
  if (already) throw new ApiError(409, "Vous avez déjà utilisé ce code coupon");
  if (subtotalCents <= 0) throw new ApiError(400, "Votre panier est vide");
  if (subtotalCents < coupon.minOrderCents) {
    throw new ApiError(400, `Ce code nécessite un minimum de commande de ${fmt(coupon.minOrderCents)} €`);
  }
  return { coupon, ...computeDiscount(coupon, subtotalCents) };
}

export function computeDiscount(coupon: Pick<Coupon, "type" | "value">, subtotalCents: number) {
  const raw = coupon.type === "POURCENTAGE" ? Math.round((subtotalCents * coupon.value) / 100) : coupon.value;
  const cap = Math.floor(subtotalCents * COUPON_MAX_RATIO);
  const discountCents = Math.max(0, Math.min(raw, cap, subtotalCents));
  const capped = discountCents < raw;
  const message =
    coupon.type === "POURCENTAGE" && !capped
      ? `Réduction de ${coupon.value}% appliquée (-${fmt(discountCents)} €)`
      : `Réduction de ${fmt(discountCents)} € appliquée${capped ? " (plafonnée à 10 % de la commande)" : ""}`;
  return { discountCents, capped, message };
}
