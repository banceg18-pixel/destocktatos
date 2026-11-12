import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError, json, limitByIp, parseBody, route } from "@/lib/server/api";
import { checkUnsubscribeToken } from "@/lib/server/notifications";
import { emailSchema } from "@/lib/validation";

const schema = z.object({ email: emailSchema, token: z.string().trim().max(64) });

/** POST /api/newsletter/unsubscribe — désinscription par le lien signé présent dans chaque email. */
export const POST = route("POST /api/newsletter/unsubscribe", async (req: Request) => {
  limitByIp(req, "newsletter-unsubscribe", 20);
  const { email, token } = await parseBody(req, schema);
  if (!checkUnsubscribeToken(email, token)) throw new ApiError(400, "Dieser Abmeldelink ist nicht gültig. Verwenden Sie den Link aus der letzten E-Mail.");
  await prisma.newsletterSubscriber.deleteMany({ where: { email } });
  return json({ message: "Sie sind vom Newsletter abgemeldet." });
});
