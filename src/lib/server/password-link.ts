import "server-only";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/seo";

/** Lien de création de compte envoyé après une commande sans compte : valable 7 jours. */
export const ACCOUNT_LINK_TTL_MS = 7 * 24 * 3600 * 1000;

/**
 * Lien à usage unique pour choisir son mot de passe (réinitialisation, ou création du compte après une
 * commande passée sans compte). Seul le haché du jeton est stocké ; l'email prouve la propriété de l'adresse.
 */
export async function passwordLink(userId: string, ttlMs: number, creation = false) {
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: { userId, tokenHash: crypto.createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + ttlMs) },
  });
  return `${SITE_URL}/connexion/reinitialiser?token=${token}${creation ? "&creation=1" : ""}`;
}
