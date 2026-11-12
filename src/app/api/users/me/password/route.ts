import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError, json, parseBody, requireUser, route } from "@/lib/server/api";
import { rateLimit } from "@/lib/server/rate-limit";
import { passwordSchema } from "@/lib/validation";

const schema = z
  .object({ current: z.string().max(200).optional(), mdp: passwordSchema, mdpv: z.string() })
  .refine((d) => d.mdp === d.mdpv, { message: "Bestätigungspasswort falsch.", path: ["mdpv"] });

/**
 * POST /api/users/me/password — change le mot de passe (l'actuel est exigé), ou en définit un pour
 * un compte créé avec Google (qui n'en a pas encore).
 */
export const POST = route("POST /api/users/me/password", async (req: Request) => {
  const session = await requireUser();
  if (!rateLimit(`password-change:${session.id}`, 8, 15 * 60 * 1000).ok) throw new ApiError(429, "Zu viele Versuche. Versuchen Sie es in wenigen Minuten erneut.");
  const { current, mdp } = await parseBody(req, schema);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.id } });
  if (user.passwordHash) {
    if (!current) throw new ApiError(400, "Geben Sie Ihr aktuelles Passwort ein.");
    if (!(await bcrypt.compare(current, user.passwordHash))) throw new ApiError(400, "Das aktuelle Passwort ist falsch.");
  }
  await prisma.user.update({ where: { id: session.id }, data: { passwordHash: await bcrypt.hash(mdp, 12) } });
  await prisma.passwordResetToken.deleteMany({ where: { userId: session.id } });
  return json({ message: user.passwordHash ? "Passwort geändert." : "Passwort erstellt: Sie können sich auch mit Ihrer E-Mail-Adresse anmelden." });
});
