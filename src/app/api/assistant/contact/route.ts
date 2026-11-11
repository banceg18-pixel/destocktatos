import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { json, limitByIp, parseBody, route } from "@/lib/server/api";
import { sendMail, STORE_EMAIL } from "@/lib/server/mailer";
import { emailSchema } from "@/lib/validation";
import { DE_PHONE_HINT, isDePhone, normalizeDePhone } from "@/lib/phone";

const CALLBACK_SUBJECT = "Rückrufanfrage (Website-Assistent)";

const schema = z
  .object({
    name: z.string().trim().min(1, "Bitte geben Sie Ihren Namen an").max(120),
    email: z.union([emailSchema, z.literal("")]).default(""),
    phone: z.string().trim().max(30).default(""),
    question: z.string().trim().min(1, "Bitte geben Sie Ihre Frage ein").max(2000, "Frage zu lang"),
    /** Letzte Nachrichten mit dem Assistenten, damit das Team den Kontext hat. */
    transcript: z
      .array(z.object({ from: z.enum(["client", "assistant"]), text: z.string().max(2000) }))
      .max(40)
      .default([]),
    page: z.string().trim().max(300).default(""),
  })
  .refine((b) => b.email || b.phone, { message: "Bitte geben Sie Ihre Telefonnummer oder E-Mail-Adresse an, damit wir Sie zurückrufen können", path: ["phone"] })
  .refine((b) => !b.phone || isDePhone(b.phone), { message: DE_PHONE_HINT, path: ["phone"] });

/**
 * POST /api/assistant/contact — der Kunde hinterlässt seine Kontaktdaten, wenn der Assistent keine Antwort hat:
 * Die Anfrage erscheint in WordPress (Shop → Nachrichten → Kontakt) und per E-Mail an das Geschäft.
 */
export const POST = route("POST /api/assistant/contact", async (req: Request) => {
  limitByIp(req, "assistant-contact", 5);
  const b = await parseBody(req, schema);
  const phone = b.phone ? normalizeDePhone(b.phone) : "";
  const history = b.transcript
    .slice(-12)
    .map((m) => `${m.from === "client" ? "Kunde" : "Assistent"} : ${m.text.replace(/\s+/g, " ").trim()}`)
    .join("\n");
  const message = [b.question, history && `\n— Gespräch mit dem Assistenten —\n${history}`, b.page && `\nBesuchte Seite: ${b.page}`].filter(Boolean).join("\n");
  const msg = await prisma.contactMessage.create({ data: { name: b.name, email: b.email, phone, subject: CALLBACK_SUBJECT, message } });
  await sendMail({
    to: STORE_EMAIL,
    tag: "assistant-rappel",
    ...(b.email ? { replyTo: b.email } : {}),
    subject: `[Assistent] ${b.name} möchte zurückgerufen werden`,
    text: [
      `${b.name} hat beim Website-Assistenten keine Antwort gefunden und möchte zurückgerufen werden.\n`,
      phone ? `Telefon: ${phone}` : "",
      b.email ? `E-Mail: ${b.email}` : "",
      `\nFrage: ${b.question}`,
      history ? `\nGespräch mit dem Assistenten:\n${history}` : "",
      b.page ? `\nBesuchte Seite: ${b.page}` : "",
      "\nIn WordPress zu finden: Shop → Nachrichten → Kontakt.",
    ]
      .filter(Boolean)
      .join("\n"),
  });
  return json({ id: msg.id, message: "Vielen Dank! Ihre Anfrage wurde übermittelt: Unser Team meldet sich in Kürze bei Ihnen." }, 201);
});
