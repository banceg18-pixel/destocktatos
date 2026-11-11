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
      subject: creation ? "Destocktatos — Erstellen Sie Ihr Passwort" : "Destocktatos — Passwort zurücksetzen",
      text: creation
        ? `Hallo,\n\nIhr Konto ist bereit: Um Ihre Bestellungen und Rechnungen einzusehen, legen Sie Ihr Passwort über diesen Link fest (gültig 1 Stunde):\n${link}\n\nFalls Sie diese Anfrage nicht gestellt haben, ignorieren Sie bitte diese E-Mail.`
        : `Hallo,\n\nUm ein neues Passwort festzulegen, öffnen Sie diesen Link (gültig 1 Stunde):\n${link}\n\nFalls Sie diese Anfrage nicht gestellt haben, ignorieren Sie bitte diese E-Mail.`,
    });
  }
  return json({ message: "Falls ein Konto für diese Adresse existiert, wurde eine E-Mail zum Zurücksetzen des Passworts gesendet." });
});
