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
  .refine((d) => d.mdp === d.mdpv, { message: "Das Bestätigungspasswort stimmt nicht überein.", path: ["mdpv"] });

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
      subject: "Destocktatos — Erstellen Sie Ihr Passwort",
      text: `Hallo,

Ihr Konto ist bereit: Ihre bisherigen Bestellungen mit dieser Adresse sind bereits vorhanden. Um auf Ihr Konto zuzugreifen, legen Sie Ihr Passwort über diesen Link fest (gültig 24 Stunden):
${link}

Falls Sie diese Anfrage nicht gestellt haben, ignorieren Sie bitte diese E-Mail.`,
    });
    throw new ApiError(409, "Sie haben bereits mit dieser Adresse bestellt: Wir haben Ihnen per E-Mail einen Link gesendet, um Ihr Passwort festzulegen und auf Ihr Konto zuzugreifen.", { field: "email" });
  }
  if (existing) throw new ApiError(409, "Mit dieser E-Mail-Adresse existiert bereits ein Konto.");
  const user = await prisma.user.create({
    data: { email, name: email.split("@")[0], passwordHash: await bcrypt.hash(mdp, 12) },
  });
  notifyWelcome(user);
  return json({ message: "Konto erfolgreich erstellt" }, 201);
});
