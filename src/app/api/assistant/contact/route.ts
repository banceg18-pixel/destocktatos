import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { json, limitByIp, parseBody, route } from "@/lib/server/api";
import { sendMail, STORE_EMAIL } from "@/lib/server/mailer";
import { emailSchema } from "@/lib/validation";
import { FR_PHONE_HINT, isFrPhone, normalizeFrPhone } from "@/lib/phone";

const CALLBACK_SUBJECT ="Demande de rappel (assistant du site)";

const schema = z
  .object({
    name: z.string().trim().min(1, "Indiquez votre nom").max(120),
    email: z.union([emailSchema, z.literal("")]).default(""),
    phone: z.string().trim().max(30).default(""),
    question: z.string().trim().min(1, "Indiquez votre question").max(2000, "Question trop longue"),
    /** Derniers échanges avec l'assistant, pour que l'équipe ait le contexte. */
    transcript: z
      .array(z.object({ from: z.enum(["client", "assistant"]), text: z.string().max(2000) }))
      .max(40)
      .default([]),
    page: z.string().trim().max(300).default(""),
  })
  .refine((b) => b.email || b.phone, { message: "Indiquez votre téléphone ou votre email pour être recontacté", path: ["phone"] })
  .refine((b) => !b.phone || isFrPhone(b.phone), { message: FR_PHONE_HINT, path: ["phone"] });

/**
 * POST /api/assistant/contact — le client laisse ses coordonnées quand l'assistant n'a pas la réponse :
 * la demande arrive dans WordPress (Boutique → Messages → Contact) et par email au magasin.
 */
export const POST = route("POST /api/assistant/contact", async (req: Request) => {
  limitByIp(req, "assistant-contact", 5);
  const b = await parseBody(req, schema);
  const phone = b.phone ? normalizeFrPhone(b.phone) : "";
  const history = b.transcript
    .slice(-12)
    .map((m) => `${m.from === "client" ? "Client" : "Assistant"} : ${m.text.replace(/\s+/g, " ").trim()}`)
    .join("\n");
  const message = [b.question, history && `\n— Échange avec l'assistant —\n${history}`, b.page && `\nPage consultée : ${b.page}`].filter(Boolean).join("\n");
  const msg = await prisma.contactMessage.create({ data: { name: b.name, email: b.email, phone, subject: CALLBACK_SUBJECT, message } });
  await sendMail({
    to: STORE_EMAIL,
    tag: "assistant-rappel",
    ...(b.email ? { replyTo: b.email } : {}),
    subject: `[Assistant] ${b.name} souhaite être recontacté`,
    text: [
      `${b.name} n'a pas trouvé sa réponse auprès de l'assistant du site et souhaite être recontacté.\n`,
      phone ? `Téléphone : ${phone}` : "",
      b.email ? `Email : ${b.email}` : "",
      `\nQuestion : ${b.question}`,
      history ? `\nÉchange avec l'assistant :\n${history}` : "",
      b.page ? `\nPage consultée : ${b.page}` : "",
      "\nÀ retrouver dans WordPress : Boutique → Messages → Contact.",
    ]
      .filter(Boolean)
      .join("\n"),
  });
  return json({ id: msg.id, message: "Merci ! Votre demande est transmise : notre équipe vous recontacte rapidement." }, 201);
});
