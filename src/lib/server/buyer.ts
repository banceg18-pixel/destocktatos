import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ApiError } from "./api";
import { getUserOrder } from "./orders";

/**
 * Achat sans compte : le visiteur commande avec son seul email, puis il est invité à créer son compte
 * (lien reçu par email) pour retrouver ses factures. Pendant le règlement, il n'a accès qu'à SA
 * commande : un cookie signé (HMAC) porte son identifiant, jamais l'accès au compte associé à l'email.
 */
const COOKIE = "tatos_commande";
const MAX_AGE_S = 7 * 24 * 3600;

const sign = (orderId: string) => crypto.createHmac("sha256", process.env.NEXTAUTH_SECRET || "tatos-commande").update(`commande:${orderId}`).digest("hex").slice(0, 40);

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** Mémorise la commande de l'invité (route API uniquement). */
export async function rememberGuestOrder(orderId: string) {
  (await cookies()).set(COOKIE, `${orderId}.${sign(orderId)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && (process.env.NEXTAUTH_URL ?? "").startsWith("https://"),
    path: "/",
    maxAge: MAX_AGE_S,
  });
}

/** Identifiant de la commande de l'invité, si son cookie est authentique. */
export async function guestOrderId(): Promise<string | null> {
  const raw = (await cookies()).get(COOKIE)?.value ?? "";
  const [id, sig] = raw.split(".");
  return id && sig && /^[A-Za-z0-9_-]{1,64}$/.test(id) && safeEqual(sig, sign(id)) ? id : null;
}

/** Utilisateur (compte connecté) ou commande d'invité en cours ; 401 sinon. */
export async function requireBuyer(): Promise<{ userId: string | null; guestOrderId: string | null; email: string | null }> {
  const session = await getSession();
  if (session?.user?.id) return { userId: session.user.id, guestOrderId: null, email: session.user.email ?? null };
  const id = await guestOrderId();
  if (!id) throw new ApiError(401, "Votre session a expiré : revenez au panier pour finaliser votre commande.");
  return { userId: null, guestOrderId: id, email: null };
}

/** Commande accessible à l'acheteur courant (compte connecté, ou invité pour sa seule commande). */
export async function getBuyerOrder(orderId: string) {
  const session = await getSession();
  if (session?.user?.id) {
    try {
      return await getUserOrder(session.user.id, orderId);
    } catch (e) {
      // Connecté, mais commande passée juste avant en invité depuis ce navigateur.
      if ((await guestOrderId()) !== orderId) throw e;
    }
  } else if ((await guestOrderId()) !== orderId) {
    throw new ApiError(404, "Commande introuvable");
  }
  const o = await prisma.order.findUnique({ where: { id: orderId }, include: { items: { include: { product: { select: { prixCents: true, slug: true } } } }, payments: true } });
  if (!o) throw new ApiError(404, "Commande introuvable");
  return o;
}
