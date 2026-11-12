import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { json, limitByIp, parseBody, route } from "@/lib/server/api";
import { sendMail, STORE_EMAIL } from "@/lib/server/mailer";
import { emailSchema } from "@/lib/validation";

const SUBJECTS = { commande: "Frage zu einer Bestellung", produit: "Frage zu einem Produkt", service: "Kundendienst", autre: "Sonstige Anfrage" } as const;

const schema = z.object({
  name: z.string().trim().min(1, "Alle Felder sind erforderlich").max(120),
  email: emailSchema,
  subject: z.enum(["commande", "produit", "service", "autre"], { errorMap: () => ({ message: "Ungültiges Anliegen" }) }),
  message: z.string().trim().min(1, "Alle Felder sind erforderlich").max(5000, "Nachricht zu lang"),
});

/** POST /api/contact — enregistre le message et notifie le magasin. */
export const POST = route("POST /api/contact", async (req: Request) => {
  limitByIp(req, "contact", 5);
  const body = await parseBody(req, schema);
  const msg = await prisma.contactMessage.create({
    data: { name: body.name, email: body.email, subject: body.subject, message: body.message },
  });
  await sendMail({
    to: STORE_EMAIL,
    tag: "contact",
    replyTo: body.email,
    subject: `[Contact] ${SUBJECTS[body.subject]} — ${body.name}`,
    text: `Von: ${body.name} <${body.email}>\nAnliegen: ${SUBJECTS[body.subject]}\n\n${body.message}`,
  });
  return json({ message: "Ihre Nachricht wurde erfolgreich gesendet!", id: msg.id }, 201);
});
