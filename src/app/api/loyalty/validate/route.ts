import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { json, limitByIp, parseBody, requireUser, route } from "@/lib/server/api";
import { evaluateCoupon } from "@/lib/server/coupons";
import { toEuros } from "@/lib/money";

const schema = z.object({ couponCode: z.string().trim().min(1, "Veuillez saisir un code de coupon").max(50), orderTotal: z.coerce.number().min(0).max(1_000_000) });

/** POST /api/loyalty/validate — vérifie un coupon fidélité (connexion requise, plafond 10 %). */
export const POST = route("POST /api/loyalty/validate", async (req: Request) => {
  limitByIp(req, "coupon", 30);
  const user = await requireUser();
  const { couponCode, orderTotal } = await parseBody(req, schema);
  const r = await evaluateCoupon(prisma, user.id, couponCode, Math.round(orderTotal * 100));
  return json({ coupon_id: r.coupon.id, couponCode: r.coupon.code, discount: toEuros(r.discountCents), message: r.message });
});
