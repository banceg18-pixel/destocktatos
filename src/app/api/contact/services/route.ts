import { z } from "zod";
import { FR_PHONE_HINT, isFrPhone, normalizeFrPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { json, limitByIp, parseBody, route } from "@/lib/server/api";
import { sendMail, STORE_EMAIL } from "@/lib/server/mailer";
import { emailSchema } from "@/lib/validation";

const SLOTS = { matin: "Matin (9h-12h)", "apres-midi": "Après-midi (14h-17h)", soire: "Soirée (17h-19h)" } as const;

const today = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split("T")[0];
};

const schema = z.object({
  name: z.string().trim().min(1, "Le nom est requis").max(120),
  email: emailSchema,
  phone: z.string().trim().min(1, "Le téléphone est requis").max(30).refine(isFrPhone, FR_PHONE_HINT).transform(normalizeFrPhone),
  address: z.string().trim().min(1, "L'adresse est requise").max(250),
  product: z.string().trim().min(1, "Le produit à installer est requis").max(200),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "La date est requise")
    .refine((d) => d >= today(), "La date ne peut pas être dans le passé"),
  timeSlot: z.enum(["matin", "apres-midi", "soire"], { errorMap: () => ({ message: "Le créneau horaire est requis" }) }),
  notes: z.string().trim().max(2000).default(""),
});

/** POST /api/contact/services — demande de devis d'installation. */
export const POST = route("POST /api/contact/services", async (req: Request) => {
  limitByIp(req, "services", 5);
  const b = await parseBody(req, schema);
  const reqRow = await prisma.serviceRequest.create({
    data: {
      fullName: b.name,
      email: b.email,
      phone: b.phone,
      service: "installation",
      details: { address: b.address, product: b.product, date: b.date, timeSlot: b.timeSlot },
      message: b.notes,
    },
  });
  await sendMail({
    to: STORE_EMAIL,
    tag: "devis-installation",
    replyTo: b.email,
    subject: `[Devis installation] ${b.product} — ${b.name}`,
    text: `Client : ${b.name} <${b.email}> — ${b.phone}\nAdresse : ${b.address}\nProduit : ${b.product}\nDate souhaitée : ${b.date} (${SLOTS[b.timeSlot]})\n\n${b.notes}`,
  });
  return json(
    { message: "Votre demande de devis a bien été envoyée. Nous vous recontacterons rapidement pour confirmer le rendez-vous.", id: reqRow.id },
    201,
  );
});
