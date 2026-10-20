import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { json, limitByIp, parseBody, route } from "@/lib/server/api";
import { sendMail } from "@/lib/server/mailer";
import { passwordLink } from "@/lib/server/password-link";
import { emailSchema } from "@/lib/validation";

const schema = z.object({ email: emailSchema });
const TOKEN_TTL_MS = 60 * 60 * 1000;

/**
 * POST /api/auth/forgot-password — génère un lien pour choisir son mot de passe, valable 1 h : nouveau
 * mot de passe, ou premier mot de passe d'un client qui a commandé sans compte.
 * La réponse est identique que le compte existe ou non (pas d'énumération d'adresses).
 */
export const POST = route("POST /api/auth/forgot-password", async (req: Request) => {
  limitByIp(req, "forgot", 5);
  const { email } = await parseBody(req, schema);
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const creation = !user.passwordHash;
    const link = await passwordLink(user.id, TOKEN_TTL_MS, creation);
    await sendMail({
      to: email,
      tag: "reinitialisation-mot-de-passe",
      subject: creation ? "Destocktatos — Créez votre mot de passe" : "Destocktatos — Réinitialisation de votre mot de passe",
      text: creation
        ? `Bonjour,\n\nVotre compte est prêt : pour y retrouver vos commandes et vos factures, choisissez votre mot de passe avec ce lien (valable 1 heure) :\n${link}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.`
        : `Bonjour,\n\nPour choisir un nouveau mot de passe, ouvrez ce lien (valable 1 heure) :\n${link}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.`,
    });
  }
  return json({ message: "Si un compte existe pour cette adresse, un email de réinitialisation a été envoyé." });
});
