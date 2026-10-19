import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError, json, limitByIp, parseBody, route } from "@/lib/server/api";
import { emailSchema } from "@/lib/validation";
import { notifyNewsletterWelcome } from "@/lib/server/notifications";

const schema = z.object({ email: emailSchema });

/** POST /api/newsletter/subscribe — inscription (idempotente : une adresse déjà inscrite renvoie 409). */
export const POST = route("POST /api/newsletter/subscribe", async (req: Request) => {
  limitByIp(req, "newsletter", 10);
  const { email } = await parseBody(req, schema);
  const existing = await prisma.newsletterSubscriber.findUnique({ where: { email } });
  if (existing) throw new ApiError(409, "Cette adresse est déjà inscrite à la newsletter");
  await prisma.newsletterSubscriber.create({ data: { email, source: "site" } });
  notifyNewsletterWelcome(email);
  return json({ message: "Inscription réussie ! Vous recevrez nos offres exclusives." }, 201);
});
