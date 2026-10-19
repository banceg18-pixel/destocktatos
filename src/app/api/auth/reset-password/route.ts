import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError, json, limitByIp, parseBody, route } from "@/lib/server/api";
import { passwordSchema } from "@/lib/validation";

const schema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/, "Lien de réinitialisation invalide"), mdp: passwordSchema });

/** POST /api/auth/reset-password — consomme un jeton (usage unique) et remplace le mot de passe. */
export const POST = route("POST /api/auth/reset-password", async (req: Request) => {
  limitByIp(req, "reset", 10);
  const { token, mdp } = await parseBody(req, schema);
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!row || row.usedAt || row.expiresAt < new Date()) {
    throw new ApiError(400, "Ce lien de réinitialisation est invalide ou a expiré. Faites une nouvelle demande.");
  }
  const passwordHash = await bcrypt.hash(mdp, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: row.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    // Invalide les autres liens encore actifs du même compte.
    prisma.passwordResetToken.updateMany({ where: { userId: row.userId, usedAt: null, id: { not: row.id } }, data: { usedAt: new Date() } }),
  ]);
  return json({ message: "Mot de passe modifié" });
});
