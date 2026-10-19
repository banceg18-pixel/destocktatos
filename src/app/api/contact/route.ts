import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { json, limitByIp, parseBody, route } from "@/lib/server/api";
import { sendMail, STORE_EMAIL } from "@/lib/server/mailer";
import { emailSchema } from "@/lib/validation";

const SUBJECTS = { commande: "Question sur une commande", produit: "Renseignement sur un produit", service: "Service après-vente", autre: "Autre demande" } as const;

const schema = z.object({
  name: z.string().trim().min(1, "Tous les champs sont obligatoires").max(120),
  email: emailSchema,
  subject: z.enum(["commande", "produit", "service", "autre"], { errorMap: () => ({ message: "Sujet invalide" }) }),
  message: z.string().trim().min(1, "Tous les champs sont obligatoires").max(5000, "Message trop long"),
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
    text: `De : ${body.name} <${body.email}>\nSujet : ${SUBJECTS[body.subject]}\n\n${body.message}`,
  });
  return json({ message: "Votre message a été envoyé avec succès !", id: msg.id }, 201);
});
