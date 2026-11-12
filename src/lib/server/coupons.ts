import "server-only";
import type { Coupon, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { COUPON_MAX_RATIO } from "@/lib/delivery";
import { ApiError } from "./api";

type Db = Prisma.TransactionClient | typeof prisma;

const fmt = (cents: number) => (cents / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Vérifie un coupon pour un client et un sous-total donnés et calcule la réduction (centimes).
 * Règle visible sur la source : la réduction est plafonnée à 10 % du montant de la commande.
 */
export async function evaluateCoupon(db: Db, userId: string, rawCode: string, subtotalCents: number) {
  const code = rawCode.trim().toUpperCase();
  if (!code) throw new ApiError(400, "Bitte geben Sie einen Gutscheincode ein");
  const coupon = await db.coupon.findUnique({ where: { code } });
  if (!coupon || !coupon.active) throw new ApiError(404, "Ungültiger Gutscheincode");
  if (coupon.expiresAt && coupon.expiresAt < new Date()) throw new ApiError(410, "Dieser Gutscheincode ist abgelaufen");
  if (coupon.userId && coupon.userId !== userId) throw new ApiError(403, "Dieser Gutscheincode gilt nicht für Ihr Konto");
  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) throw new ApiError(410, "Dieser Gutscheincode wurde bereits verwendet");
  const already = await db.couponRedemption.findFirst({ where: { couponId: coupon.id, userId } });
  if (already) throw new ApiError(409, "Sie haben diesen Gutscheincode bereits verwendet");
  if (subtotalCents <= 0) throw new ApiError(400, "Ihr Warenkorb ist leer");
  if (subtotalCents < coupon.minOrderCents) {
    throw new ApiError(400, `Dieser Code erfordert einen Mindestbestellwert von ${fmt(coupon.minOrderCents)} €`);
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
      ? `Rabatt von ${coupon.value}% angewendet (−${fmt(discountCents)} €)`
      : `Rabatt von ${fmt(discountCents)} € angewendet${capped ? " (begrenzt auf 10 % der Bestellung)" : ""}`;
  return { discountCents, capped, message };
}
