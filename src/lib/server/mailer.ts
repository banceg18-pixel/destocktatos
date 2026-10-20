import "server-only";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import nodemailer, { type Transporter } from "nodemailer";
import { getSiteSettings } from "@/lib/cms";
import { textEmail } from "./email-layout";

/**
 * Notifications email.
 * - Serveur d'envoi SMTP : variables d'environnement (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
 *   `SMTP_PASS`, `MAIL_FROM`, `STORE_NOTIFICATION_EMAIL`), ou à défaut configuration enregistrée en
 *   base (clé « smtp », voir scripts/configure-email.ts) : rien à saisir chez l'hébergeur.
 * - Sans configuration, ou si l'envoi échoue, les messages sont écrits dans `MAIL_OUTBOX_DIR` (par
 *   défaut ./outbox) : rien n'est perdu et l'opération métier (commande, message…) n'échoue jamais.
 */
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  /** Version HTML mise en forme ; à défaut, le texte est présenté dans le gabarit aux couleurs du site. */
  html?: string;
  tag: string;
  /** Adresse de réponse (ex. email du client pour un message de contact). */
  replyTo?: string;
  /** En-têtes supplémentaires (ex. List-Unsubscribe pour la newsletter). */
  headers?: Record<string, string>;
  /** Pièces jointes (ex. facture PDF). */
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
}

export interface MailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  /** Expéditeur affiché, ex. « Destocktatos <contacts@destocktatos.com> ». */
  from: string;
  /** Boîte qui reçoit les alertes du magasin (nouvelle commande, messages). */
  store?: string;
}

/** Dossier des emails non envoyés (MAIL_OUTBOX_DIR, par défaut ./outbox). */
const outboxDir = () => process.env.MAIL_OUTBOX_DIR || path.join(process.cwd(), "outbox");

/** Destinataire « magasin » : remplacé à l'envoi par la boîte du magasin configurée. */
export const STORE_EMAIL = "magasin@destinataire.invalid";
const DEFAULT_STORE = "contacts@destocktatos.com";

function envConfig(): MailConfig | null {
  if (!process.env.SMTP_HOST) return null;
  const port = Number(process.env.SMTP_PORT || 587);
  return {
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.MAIL_FROM || process.env.SMTP_USER || "",
    store: process.env.STORE_NOTIFICATION_EMAIL,
  };
}

const CONFIG_TTL_MS = 60_000;
let cached: { at: number; value: MailConfig | null } | null = null;

/** Configuration d'envoi : environnement, sinon base (relue toutes les minutes) ; null = outbox. */
export async function mailConfig(): Promise<MailConfig | null> {
  const env = envConfig();
  if (env) return env;
  // Tests et développement : jamais d'envoi réel tant que MAIL_OUTBOX_ONLY est actif.
  if (process.env.MAIL_OUTBOX_ONLY === "true") return null;
  if (cached && Date.now() - cached.at < CONFIG_TTL_MS) return cached.value;
  let value: MailConfig | null = null;
  try {
    const { prisma } = await import("@/lib/prisma");
    const row = await prisma.siteState.findUnique({ where: { key: "smtp" } });
    const c = row ? (JSON.parse(row.value) as Partial<MailConfig>) : null;
    value = c?.host && c.user && c.pass ? { host: c.host, port: Number(c.port || 465), secure: c.secure ?? Number(c.port || 465) === 465, user: c.user, pass: c.pass, from: c.from || c.user, store: c.store } : null;
  } catch (e) {
    console.error("[mailer] configuration d'envoi illisible :", (e as Error).message);
    value = cached?.value ?? null;
  }
  cached = { at: Date.now(), value };
  return value;
}

export async function smtpConfigured() {
  return !!(await mailConfig());
}

/** Boîte du magasin (alertes) : configuration d'envoi, sinon STORE_NOTIFICATION_EMAIL. */
async function storeAddress(config: MailConfig | null) {
  return config?.store || process.env.STORE_NOTIFICATION_EMAIL || config?.user || DEFAULT_STORE;
}

let transporter: { key: string; t: Transporter } | null = null;
function smtp(c: MailConfig): Transporter {
  const key = `${c.host}:${c.port}:${c.user}:${crypto.createHash("sha256").update(c.pass).digest("hex")}`;
  if (transporter?.key !== key) {
    transporter?.t.close();
    transporter = {
      key,
      t: nodemailer.createTransport({
        host: c.host,
        port: c.port,
        secure: c.secure,
        auth: c.user ? { user: c.user, pass: c.pass } : undefined,
        pool: true,
        maxConnections: 3,
        connectionTimeout: 15_000,
        socketTimeout: 30_000,
      }),
    };
  }
  return transporter.t;
}

/** Version HTML : celle du message, ou le texte dans le gabarit du site (coordonnées du magasin en pied). */
async function toHtml(msg: MailMessage) {
  if (msg.html) return msg.html;
  const s = await getSiteSettings().catch(() => null);
  return textEmail(msg.text, s ? { name: s.siteName, address: `${s.addressLine}, ${s.postalCode} ${s.city}`, phone: s.phone, email: s.email } : null);
}

async function writeOutbox(msg: MailMessage, reason?: string) {
  try {
    const dir = outboxDir();
    await fs.mkdir(dir, { recursive: true });
    // Suffixe aléatoire : plusieurs emails écrits dans la même milliseconde (newsletter) ne s'écrasent pas.
    const file = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}-${crypto.randomBytes(3).toString("hex")}-${msg.tag}.json`);
    // Pièces jointes conservées en base64 (renvoi possible à la main).
    const attachments = msg.attachments?.map((a) => ({ filename: a.filename, contentType: a.contentType, size: a.content.length, base64: a.content.toString("base64") }));
    await fs.writeFile(file, JSON.stringify({ ...msg, attachments, ...(reason ? { notSentReason: reason } : {}), createdAt: new Date().toISOString() }, null, 2), "utf8");
    return file;
  } catch (e) {
    console.error("[mailer] impossible d'écrire la notification", e);
    return "";
  }
}

export async function sendMail(input: MailMessage): Promise<{ delivered: false; stored: string } | { delivered: true }> {
  const config = await mailConfig();
  const to = input.to === STORE_EMAIL ? await storeAddress(config) : input.to;
  const msg = { ...input, to, html: await toHtml(input) };
  if (!config) return { delivered: false, stored: await writeOutbox(msg) };
  try {
    await smtp(config).sendMail({
      from: config.from,
      to: msg.to,
      replyTo: msg.replyTo,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
      headers: msg.headers,
      attachments: msg.attachments,
    });
    return { delivered: true };
  } catch (e) {
    // Une notification ne doit jamais faire échouer l'opération métier déjà enregistrée.
    console.error("[mailer] envoi SMTP impossible, message conservé dans l'outbox :", (e as Error).message);
    return { delivered: false, stored: await writeOutbox(msg, (e as Error).message) };
  }
}

/** Envoi sans attendre (notifications après une opération déjà enregistrée). */
export function sendMailInBackground(msg: MailMessage) {
  sendMail(msg).catch((e) => console.error("[mailer]", e));
}
