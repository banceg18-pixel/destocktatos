import "server-only";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Notifications email.
 * - Avec un serveur SMTP configuré (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`),
 *   les messages sont réellement envoyés (Brevo, Mailjet, OVH, Gmail, Outlook… : tout fournisseur SMTP).
 * - Sans configuration, ou si l'envoi échoue, ils sont écrits dans `MAIL_OUTBOX_DIR` (par défaut
 *   ./outbox) : rien n'est perdu et l'opération métier (commande, message…) n'échoue jamais.
 */
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  tag: string;
  /** Adresse de réponse (ex. email du client pour un message de contact). */
  replyTo?: string;
  /** En-têtes supplémentaires (ex. List-Unsubscribe pour la newsletter). */
  headers?: Record<string, string>;
}

/** Dossier des emails non envoyés (MAIL_OUTBOX_DIR, par défaut ./outbox). */
const outboxDir = () => process.env.MAIL_OUTBOX_DIR || path.join(process.cwd(), "outbox");
export const STORE_EMAIL = process.env.STORE_NOTIFICATION_EMAIL || "tatos-electromenager@outlook.com";

export const smtpConfigured = () => !!process.env.SMTP_HOST;

let transporter: Transporter | null = null;
function smtp(): Transporter {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 587);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      pool: true,
      maxConnections: 3,
      connectionTimeout: 15_000,
      socketTimeout: 30_000,
    });
  }
  return transporter;
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Version HTML sobre du texte (paragraphes, liens cliquables), lisible dans tous les clients mail. */
function toHtml(text: string) {
  const body = escapeHtml(text)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px">${p.replace(/\n/g, "<br>").replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#121212">$1</a>')}</p>`)
    .join("");
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#f4f4f2;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#121212;font-size:15px;line-height:1.6"><div style="max-width:560px;margin:0 auto;background:#ffffff;padding:32px">${body}</div></body></html>`;
}

async function writeOutbox(msg: MailMessage, reason?: string) {
  try {
    const dir = outboxDir();
    await fs.mkdir(dir, { recursive: true });
    // Suffixe aléatoire : plusieurs emails écrits dans la même milliseconde (newsletter) ne s'écrasent pas.
    const file = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}-${crypto.randomBytes(3).toString("hex")}-${msg.tag}.json`);
    await fs.writeFile(file, JSON.stringify({ ...msg, ...(reason ? { notSentReason: reason } : {}), createdAt: new Date().toISOString() }, null, 2), "utf8");
    return file;
  } catch (e) {
    console.error("[mailer] impossible d'écrire la notification", e);
    return "";
  }
}

export async function sendMail(msg: MailMessage): Promise<{ delivered: false; stored: string } | { delivered: true }> {
  if (!smtpConfigured()) return { delivered: false, stored: await writeOutbox(msg) };
  try {
    await smtp().sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: msg.to,
      replyTo: msg.replyTo,
      subject: msg.subject,
      text: msg.text,
      html: toHtml(msg.text),
      headers: msg.headers,
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
