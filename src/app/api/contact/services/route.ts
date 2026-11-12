import { z } from "zod";
import { DE_PHONE_HINT, isDePhone, normalizeDePhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { json, limitByIp, parseBody, route } from "@/lib/server/api";
import { sendMail, STORE_EMAIL } from "@/lib/server/mailer";
import { emailSchema } from "@/lib/validation";

const SLOTS = { matin: "Vormittag (9-12 Uhr)", "apres-midi": "Nachmittag (14-17 Uhr)", soire: "Abend (17-19 Uhr)" } as const;

const today = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split("T")[0];
};

const schema = z.object({
  name: z.string().trim().min(1, "Der Name ist erforderlich").max(120),
  email: emailSchema,
  phone: z.string().trim().min(1, "Die Telefonnummer ist erforderlich").max(30).refine(isDePhone, DE_PHONE_HINT).transform(normalizeDePhone),
  address: z.string().trim().min(1, "Die Adresse ist erforderlich").max(250),
  product: z.string().trim().min(1, "Das zu installierende Gerät ist erforderlich").max(200),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Das Datum ist erforderlich")
    .refine((d) => d >= today(), "Das Datum darf nicht in der Vergangenheit liegen"),
  timeSlot: z.enum(["matin", "apres-midi", "soire"], { errorMap: () => ({ message: "Das Zeitfenster ist erforderlich" }) }),
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
    subject: `[Installationsangebot] ${b.product} — ${b.name}`,
    text: `Kunde: ${b.name} <${b.email}> — ${b.phone}\nAdresse: ${b.address}\nGerät: ${b.product}\nGewünschtes Datum: ${b.date} (${SLOTS[b.timeSlot]})\n\n${b.notes}`,
  });
  return json(
    { message: "Ihre Anfrage wurde gesendet. Wir melden uns schnell bei Ihnen, um den Termin zu bestätigen.", id: reqRow.id },
    201,
  );
});
