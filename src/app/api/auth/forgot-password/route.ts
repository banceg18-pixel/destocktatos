import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { json, limitByIp, parseBody, route } from "@/lib/server/api";
import { sendMail } from "@/lib/server/mailer";
import { SITE_URL } from "@/lib/seo";
import { emailSchema } from "@/lib/validation";

const schema = z.object({ email: emailSchema });
const TOKEN_TTL_MS = 60 * 60 * 1000;

/**
 * POST /api/auth/forgot-password — génère un lien de réinitialisation valable 1 h.
 * La réponse est identique que le compte existe ou non (pas d'énumération d'adresses).
 */
export const POST = route("POST /api/auth/forgot-password", async (req: Request) => {
  limitByIp(req, "forgot", 5);
  const { email } = await parseBody(req, schema);
  const user = await prisma.user.findUnique({ where: { email } });
  if (user?.passwordHash) {
    const token = crypto.randomBytes(32).toString("hex");
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      },
    });
    const link = `${SITE_URL}/connexion/reinitialiser?token=${token}`;
    await sendMail({
      to: email,
      tag: "reinitialisation-mot-de-passe",
      subject: "Destocktatos — Réinitialisation de votre mot de passe",
      text: `Bonjour,\n\nPour choisir un nouveau mot de passe, ouvrez ce lien (valable 1 heure) :\n${link}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.`,
    });
  }
  return json({ message: "Si un compte existe pour cette adresse, un email de réinitialisation a été envoyé." });
});
