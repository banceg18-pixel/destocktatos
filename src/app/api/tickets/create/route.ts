import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { json, limitByIp, parseBody, route } from "@/lib/server/api";
import { sendMail, STORE_EMAIL } from "@/lib/server/mailer";
import { emailSchema } from "@/lib/validation";

const schema = z.object({
  titre: z.string().trim().min(1, "Le titre est requis").max(200),
  description: z.string().trim().min(1, "La description est requise").max(2000),
  type: z.enum(["bug", "amelioration", "fonctionnalite"]),
  priorite: z.enum(["basse", "normale", "haute", "critique"]),
  email: emailSchema,
  navigateur: z.string().trim().max(100).default(""),
  url: z.union([z.literal(""), z.string().trim().url("URL invalide").max(500)]).default(""),
  images: z
    .array(z.object({ url: z.string().regex(/^tickets\/[0-9a-f-]{36}\.(png|jpg|gif|webp)$/), name: z.string().max(120) }))
    .max(3)
    .default([]),
});

/** POST /api/tickets/create — ticket d'assistance (bug, amélioration, fonctionnalité). */
export const POST = route("POST /api/tickets/create", async (req: Request) => {
  limitByIp(req, "ticket", 5);
  const b = await parseBody(req, schema);
  const session = await getSession();
  const number = `TCK-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  const ticket = await prisma.ticket.create({
    data: {
      number,
      userId: session?.user?.id ?? null,
      type: b.type,
      priority: b.priorite,
      title: b.titre,
      description: b.description,
      details: { navigateur: b.navigateur, url: b.url },
      images: b.images,
      email: session?.user?.email ?? b.email,
      name: session?.user?.name ?? "",
    },
  });
  await sendMail({
    to: STORE_EMAIL,
    tag: "ticket",
    replyTo: ticket.email,
    subject: `[Ticket ${number}] (${b.priorite}) ${b.titre}`,
    text: `Type : ${b.type}\nPriorité : ${b.priorite}\nDe : ${ticket.email}\nNavigateur : ${b.navigateur}\nURL : ${b.url}\n\n${b.description}\n\nPièces jointes : ${b.images.map((i) => i.url).join(", ") || "aucune"}`,
  });
  return json({ message: "Ticket créé", ticketNumber: number, id: ticket.id }, 201);
});
