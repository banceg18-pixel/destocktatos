import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError, json, limitByIp, parseBody, route } from "@/lib/server/api";
import { emailSchema, passwordSchema } from "@/lib/validation";
import { notifyWelcome } from "@/lib/server/notifications";
import { sendMail } from "@/lib/server/mailer";
import { passwordLink } from "@/lib/server/password-link";

const schema = z
  .object({ email: emailSchema, mdp: passwordSchema, mdpv: z.string() })
  .refine((d) => d.mdp === d.mdpv, { message: "Mot de passe de confirmation erroné.", path: ["mdpv"] });

/** POST /api/auth/register — création de compte (mot de passe haché avec bcrypt). */
export const POST = route("POST /api/auth/register", async (req: Request) => {
  limitByIp(req, "register", 10);
  const { email, mdp } = await parseBody(req, schema);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && !existing.passwordHash) {
    // Compte créé par une commande sans compte : l'adresse doit être confirmée par le lien reçu par email.
    const link = await passwordLink(existing.id, 24 * 3600 * 1000, true);
    await sendMail({
      to: email,
      tag: "creation-compte",
      subject: "Destocktatos — Créez votre mot de passe",
      text: `Bonjour,

Votre compte est prêt : vos commandes passées avec cette adresse y sont déjà. Pour y accéder, choisissez votre mot de passe avec ce lien (valable 24 heures) :
${link}

Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.`,
    });
    throw new ApiError(409, "Vous avez déjà commandé avec cette adresse : nous venons de vous envoyer par email un lien pour choisir votre mot de passe et accéder à votre compte.", { field: "email" });
  }
  if (existing) throw new ApiError(409, "Un compte existe déjà avec cette adresse email.");
  const user = await prisma.user.create({
    data: { email, name: email.split("@")[0], passwordHash: await bcrypt.hash(mdp, 12) },
  });
  notifyWelcome(user);
  return json({ message: "Compte créé avec succès" }, 201);
});
