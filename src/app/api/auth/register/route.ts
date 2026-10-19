import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError, json, limitByIp, parseBody, route } from "@/lib/server/api";
import { emailSchema, passwordSchema } from "@/lib/validation";
import { notifyWelcome } from "@/lib/server/notifications";

const schema = z
  .object({ email: emailSchema, mdp: passwordSchema, mdpv: z.string() })
  .refine((d) => d.mdp === d.mdpv, { message: "Mot de passe de confirmation erroné.", path: ["mdpv"] });

/** POST /api/auth/register — création de compte (mot de passe haché avec bcrypt). */
export const POST = route("POST /api/auth/register", async (req: Request) => {
  limitByIp(req, "register", 10);
  const { email, mdp } = await parseBody(req, schema);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new ApiError(409, "Un compte existe déjà avec cette adresse email.");
  const user = await prisma.user.create({
    data: { email, name: email.split("@")[0], passwordHash: await bcrypt.hash(mdp, 12) },
  });
  notifyWelcome(user);
  return json({ message: "Compte créé avec succès" }, 201);
});
