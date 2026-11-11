import "server-only";
import crypto from "node:crypto";
import type { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatEuros, toEuros } from "@/lib/money";
import { SITE_URL } from "@/lib/seo";
import { getSiteSettings } from "@/lib/cms";
import type { SiteSettings } from "@/lib/cms/types";
import { bankDetailsOf, transferLines, type BankDetails } from "@/lib/bank";
import { legalLines } from "@/lib/brand";
import { buildInvoicePdf, documentKind, invoiceNumber, invoiceStore, quoteAvailable, quoteNumber } from "./invoice";
import { button, emailLayout, heading, infoBox, orderTable, para, subheading, type EmailStore } from "./email-layout";
import { ACCOUNT_LINK_TTL_MS, passwordLink } from "./password-link";
import { sendMail, sendMailInBackground, STORE_EMAIL } from "./mailer";

/**
 * Emails transactionnels : confirmation de commande (client et magasin, facture PDF jointe), suivi de statut,
 * bienvenue, newsletter. HTML aux couleurs du site (email-layout.ts) avec sa version texte ; envoi par
 * SMTP ou outbox (voir mailer.ts).
 */

const DELIVERY = { piedDuCamion: "Lieferung bis Bordsteinkante", livraisonPiece: "Lieferung in den Raum", installation: "Lieferung mit Installation" } as const;
const eur = (cents: number) => formatEuros(toEuros(cents));

async function signature() {
  const s = await getSiteSettings().catch(() => null);
  if (!s) return "";
  return `${s.siteName}\n${s.addressLine}, ${s.postalCode} ${s.city}\n${s.phone} · ${s.email}`;
}

type AddressJson = { fullName?: string; address?: string; postalCode?: string; city?: string; phone?: string; floor?: string | number } | null;
const addressLines = (a: AddressJson) => (a ? [a.fullName, a.address, `${a.postalCode ?? ""} ${a.city ?? ""}`.trim(), a.phone].filter(Boolean).join("\n") : "");

async function loadOrder(orderId: string) {
  return prisma.order.findUnique({ where: { id: orderId }, include: { items: true, user: { select: { name: true, email: true, passwordHash: true } } } });
}
type FullOrder = NonNullable<Awaited<ReturnType<typeof loadOrder>>>;

function summary(o: FullOrder) {
  const lines = o.items.map((i) => `- ${i.quantity} × ${i.marque} ${i.titre} — ${eur(i.lineTotalCents)}`);
  const delivery = o.isPickupInStore
    ? "Selbstabholung im Geschäft: Kostenlos"
    : `${DELIVERY[o.deliveryMethod as keyof typeof DELIVERY] ?? "Lieferung"}${o.deliveryDistanceKm ? ` (${Math.round(o.deliveryDistanceKm)} km)` : ""}${o.includeOldItemPickup ? ", Altgeräterücknahme inklusive" : ""} : ${o.deliveryFeeCents ? eur(o.deliveryFeeCents) : "kostenlos"}`;
  return [
    ...lines,
    "",
    `Zwischensumme: ${eur(o.subtotalCents)}`,
    ...(o.discountCents ? [`Rabatt${o.couponCode ? ` (${o.couponCode})` : ""}: −${eur(o.discountCents)}`] : []),
    delivery,
    `Gesamtsumme: ${eur(o.totalCents)}`,
  ].join("\n");
}

const PAYMENT_LABELS: Record<string, string> = {
  stripe: "Online-Kartenzahlung (Stripe)",
  virement: "Banküberweisung / Direktüberweisung vor Lieferung",
  sur_place: "Zahlung bei Lieferung oder Abholung",
  test: "Simulation (automatisierte Tests)",
};

/** Pièce jointe : la facture si la commande est payée, sinon le devis (avec les informations de paiement). */
function orderAttachments(o: FullOrder, s: SiteSettings | null) {
  if (!s || !quoteAvailable(o)) return [];
  const kind = documentKind(o);
  const filename = kind === "facture" ? `rechnung_${invoiceNumber(o)}.pdf` : `auftragsbestaetigung_${quoteNumber(o)}.pdf`;
  return [{ filename, content: buildInvoicePdf(o, o.user, invoiceStore(s), bankDetailsOf(s), kind), contentType: "application/pdf" }];
}

const emailStore = (s: SiteSettings | null): EmailStore | null =>
  s ? { name: s.siteName, address: `${s.addressLine}, ${s.postalCode} ${s.city}`, phone: s.phone, email: s.email, legal: legalLines(s) } : null;

/** Lignes du virement attendu : montant, communication, numéro de commande, coordonnées bancaires. */
const transferRows = (o: FullOrder, bank: BankDetails | null) => transferLines(eur(o.totalCents), o.number, bank).rows;

function deliveryLabel(o: FullOrder) {
  if (o.isPickupInStore) return "Selbstabholung im Geschäft";
  return `${DELIVERY[o.deliveryMethod as keyof typeof DELIVERY] ?? "Lieferung"}${o.includeOldItemPickup ? " + Altgeräterücknahme" : ""}`;
}

/** Récapitulatif HTML (articles et totaux). */
function summaryTable(o: FullOrder) {
  return orderTable(
    o.items.map((i) => ({ label: `${i.marque} ${i.titre}`.trim(), detail: `Menge ${i.quantity} · ${eur(i.unitPriceCents)} pro Einheit`, amount: eur(i.lineTotalCents) })),
    [
      { label: "Zwischensumme", amount: eur(o.subtotalCents) },
      ...(o.discountCents ? [{ label: `Rabatt${o.couponCode ? ` (${o.couponCode})` : ""}`, amount: `−${eur(o.discountCents)}` }] : []),
      { label: deliveryLabel(o), amount: o.deliveryFeeCents ? eur(o.deliveryFeeCents) : "Kostenlos" },
      { label: "Gesamtbetrag (inkl. MwSt.)", amount: eur(o.totalCents), strong: true },
    ],
  );
}

/**
 * Espace client : un client sans mot de passe (commande passée sans compte) reçoit un lien personnel
 * pour créer son compte ; les autres sont invités à se connecter. Dans les deux cas, il y retrouve
 * ses commandes et ses factures.
 */
async function accountInvite(o: FullOrder) {
  if (o.user.passwordHash) {
    const url = `${SITE_URL}/connexion?callbackUrl=${encodeURIComponent("/compte/commandes")}`;
    return {
      text: `Verwalten Sie Ihre Bestellungen und Rechnungen in Ihrem Kundenkonto: ${url}`,
      html: subheading("Ihr Kundenbereich") + para("Verfolgen Sie Ihre Bestellung und greifen Sie jederzeit auf Ihre Rechnungen zu.") + button("Anmelden", url),
    };
  }
  const link = await passwordLink(o.userId, ACCOUNT_LINK_TTL_MS, true);
  return {
    text: `Erstellen Sie Ihr Konto, um Ihre Bestellung zu verfolgen und Ihre Rechnungen einzusehen:\n${link}`,
    html:
      subheading("Kundenkonto aktivieren") +
      para("Um Ihre Bestellung zu verfolgen und Rechnungen einzusehen, vergeben Sie einfach ein Passwort. Ihr Konto ist bereits für Ihre E-Mail-Adresse vorbereitet.") +
      button("Konto einrichten", link) +
      para("Persönlicher Link, gültig für 7 Tage.", { muted: true, size: 13 }),
  };
}

/**
 * Commande payée, ou confirmée avec règlement par virement : email au client (récapitulatif, devis PDF
 * avec les informations de paiement — la facture suit à réception du paiement —, invitation à créer son
 * compte) et alerte au magasin.
 */
export async function notifyOrderPaid(orderId: string) {
  const o = await loadOrder(orderId);
  if (!o) return;
  const s = await getSiteSettings().catch(() => null);
  const bank = bankDetailsOf(s);
  const awaitingTransfer = o.status === "EN_ATTENTE_VIREMENT" && !o.paidAt;
  const attachments = orderAttachments(o, s);
  const account = await accountInvite(o);
  const ship = o.shippingAddress as AddressJson;
  const where = o.isPickupInStore
    ? `Selbstabholung: ${s ? `${s.addressLine}, ${s.postalCode} ${s.city} (${s.storeHours})` : "an unserer Filialadresse"}. Wir benachrichtigen Sie, sobald Ihre Bestellung abholbereit ist.`
    : `Lieferadresse:\n${addressLines(ship)}\n\nWir kontaktieren Sie zur Abstimmung des genauen Liefertermins.`;
  const docs = !attachments.length ? "" : awaitingTransfer ? "Ihre Bestellübersicht / Proforma-Rechnung mit den Zahlungsinformationen ist als PDF beigefügt. Die endgültige Rechnung erhalten Sie unmittelbar nach Zahlungseingang." : "Ihre Rechnung ist als PDF beigefügt.";
  const transferNote = transferLines(eur(o.totalCents), o.number, bank).note;
  const text = `Guten Tag ${o.user.name},

${
  awaitingTransfer
    ? `Vielen Dank für Ihre Bestellung ${o.number}: Sie ist registriert und Ihre Artikel sind reserviert.

Bitte überweisen Sie ${eur(o.totalCents)} per Banküberweisung:
${transferRows(o, bank)
  .map(([l, v]) => `${l}: ${v}`)
  .join("\n")}${bank ? "" : "\n\nUnsere Bankverbindung wird Ihnen in Kürze per E-Mail zugesendet."}

${transferNote}`
    : `Vielen Dank für Ihre Bestellung ${o.number}: Ihre Zahlung in Höhe von ${eur(o.totalCents)} wurde erfolgreich bestätigt.`
}${docs ? `\n\n${docs}` : ""}

${summary(o)}

${where}

${account.text}

${await signature()}`;
  const html = emailLayout({
    store: emailStore(s),
    preheader: awaitingTransfer ? `Bestellung ${o.number}: Bitte überweisen Sie ${eur(o.totalCents)} zur Bestätigung.` : `Bestellung ${o.number} bestätigt und bezahlt.`,
    body:
      heading("Vielen Dank für Ihre Bestellung!") +
      para(`Guten Tag ${o.user.name},`) +
      (awaitingTransfer
        ? para(`Ihre Bestellung ${o.number} ist eingegangen und die Artikel sind für Sie reserviert. Bitte überweisen Sie ${eur(o.totalCents)} per Banküberweisung zur Bestätigung.`) +
          infoBox("Banküberweisung / Zahlungsdaten", transferRows(o, bank), bank ? transferNote : `Unsere Bankverbindung erhalten Sie in Kürze per E-Mail. ${transferNote}`)
        : para(`Ihre Bestellung ${o.number} ist bestätigt: Die Zahlung von ${eur(o.totalCents)} wurde erfolgreich verbucht.`)) +
      (docs ? para(docs, { muted: true }) : "") +
      subheading("Bestellübersicht") +
      summaryTable(o) +
      subheading(o.isPickupInStore ? "Abholung" : "Lieferung") +
      para(o.isPickupInStore ? where : `${addressLines(ship)}`) +
      (o.isPickupInStore ? "" : para("Wir kontaktieren Sie zur Abstimmung des genauen Liefertermins.", { muted: true })) +
      account.html,
  });
  await sendMail({
    to: o.user.email,
    tag: "commande-confirmation",
    subject: awaitingTransfer ? `Bestellung ${o.number}: Zahlungsinformationen und Übersicht` : `Bestellung ${o.number} bestätigt`,
    text,
    html,
    attachments,
  });
  const storeAction = awaitingTransfer
    ? `, ausstehend (Referenz ${o.number}).
Sobald die Überweisung eingegangen ist, markieren Sie die Bestellung bitte als « Bezahlt »: Der Kunde wird automatisch benachrichtigt.${
        bank
          ? ""
          : "\n\nACHTUNG: Bankdaten nicht hinterlegt."
      }`
    : "";
  const soldOut = await prisma.product.findMany({ where: { id: { in: o.items.map((i) => i.productId) }, stock: { lte: 0 } }, select: { titre: true, marque: true } });
  await sendMail({
    to: STORE_EMAIL,
    replyTo: o.user.email,
    tag: "commande-magasin",
    subject: `Neue Bestellung ${o.number} — ${eur(o.totalCents)}${awaitingTransfer ? " — Überweisung erwartet" : ""}`,
    text: `Kunde: ${o.user.name} <${o.user.email}>${o.user.passwordHash ? "" : " (Gastbestellung)"}
${o.isPickupInStore ? "Selbstabholung im Geschäft" : `Lieferung:\n${addressLines(ship)}`}

${summary(o)}

Zahlungsmethode: ${PAYMENT_LABELS[o.paymentProvider ?? ""] ?? o.paymentProvider ?? "—"}${storeAction}${soldOut.length ? `

LAGERBESTAND ERSCHÖPFT: ${soldOut.map((p) => `${p.marque} ${p.titre}`.trim()).join(", ")}.` : ""}`,
    attachments,
  });
}

const STATUS_MAIL: Partial<Record<OrderStatus, (o: FullOrder) => { subject: string; body: string; invoice?: boolean }>> = {
  PAYEE: (o) => ({
    subject: `Zahlungseingang bestätigt: Bestellung ${o.number} wird vorbereitet`,
    body: `Wir haben Ihre Überweisung über ${eur(o.totalCents)} erhalten. Ihre Bestellung wird nun vorbereitet: ${o.isPickupInStore ? "Wir benachrichtigen Sie, sobald sie abholbereit ist." : "Wir kontaktieren Sie zur Abstimmung des Liefertermins."} Ihre quittierte Rechnung ist beigefügt.`,
    invoice: true,
  }),
  EN_PREPARATION: (o) => ({ subject: `Bestellung ${o.number} in Vorbereitung`, body: "Ihre Bestellung wird derzeit in unserer Filiale vorbereitet." }),
  EXPEDIEE: (o) =>
    o.isPickupInStore
      ? { subject: `Bestellung ${o.number} abholbereit`, body: "Ihre Bestellung ist abholbereit in unserer Filiale. Bitte bringen Sie Ihre Bestellnummer mit." }
      : { subject: `Bestellung ${o.number} wird geliefert`, body: "Ihre Bestellung ist auf dem Weg und wird zum vereinbarten Termin geliefert." },
  LIVREE: (o) => ({
    subject: `Bestellung ${o.number} ${o.isPickupInStore ? "abgeholt" : "geliefert"}`,
    body: `Ihre Bestellung wurde erfolgreich ${o.isPickupInStore ? "abgeholt" : "zugestellt"}. Vielen Dank für Ihr Vertrauen!`,
  }),
  ANNULEE: (o) => ({
    subject: `Bestellung ${o.number} storniert`,
    body: `Ihre Bestellung wurde storniert.${o.paidAt ? " Eine eventuelle Erstattung erfolgt innerhalb von 5 bis 10 Werktagen auf Ihr Bankkonto." : ""} Bei Fragen antworten Sie einfach auf diese E-Mail.`,
  }),
};

/** Changement de statut décidé par le magasin : le client est prévenu. */
export async function notifyOrderStatus(orderId: string, status: OrderStatus) {
  const make = STATUS_MAIL[status];
  if (!make) return;
  const o = await loadOrder(orderId);
  if (!o) return;
  const { subject, body, invoice } = make(o);
  const s = await getSiteSettings().catch(() => null);
  const attachments = invoice ? orderAttachments(o, s) : [];
  const url = `${SITE_URL}/compte/commandes`;
  await sendMail({
    to: o.user.email,
    tag: `commande-${status.toLowerCase()}`,
    subject,
    text: `Guten Tag ${o.user.name},\n\n${body}\n\nBestellung ${o.number} — ${eur(o.totalCents)}\nDetails: ${url}\n\n${await signature()}`,
    html: emailLayout({
      store: emailStore(s),
      preheader: body.slice(0, 120),
      body:
        heading(subject) +
        para(`Guten Tag ${o.user.name},`) +
        para(body) +
        infoBox(`Bestellung ${o.number}`, [
          ["Betrag", eur(o.totalCents)],
          ["Lieferart", deliveryLabel(o)],
        ]) +
        button("Bestellung einsehen", url),
    }),
    attachments,
  });
}

export function notifyWelcome(user: { name: string; email: string }) {
  void signature().then((sig) =>
    sendMailInBackground({
      to: user.email,
      tag: "bienvenue",
      subject: "Willkommen in Ihrem Kundenbereich",
      text: `Guten Tag ${user.name},\n\nIhr Kundenkonto wurde erfolgreich erstellt. Sie können hier Ihre Bestellungen verfolgen und Rechnungen herunterladen: ${SITE_URL}/compte\n\n${sig}`,
    }),
  );
}

/* ---------------------------------------------------------------------------- Newsletter */

/** Jeton de désinscription : signature HMAC de l'adresse (aucun stockage, impossible à deviner). */
export function unsubscribeToken(email: string) {
  return crypto.createHmac("sha256", process.env.NEXTAUTH_SECRET || "tatos-newsletter").update(email.trim().toLowerCase()).digest("hex").slice(0, 32);
}

export function unsubscribeUrl(email: string) {
  return `${SITE_URL}/newsletter/desinscription?email=${encodeURIComponent(email)}&token=${unsubscribeToken(email)}`;
}

export function checkUnsubscribeToken(email: string, token: string) {
  const expected = Buffer.from(unsubscribeToken(email));
  const given = Buffer.from(token);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

export function newsletterMessage(email: string, subject: string, text: string, tag = "newsletter") {
  const url = unsubscribeUrl(email);
  return {
    to: email,
    tag,
    subject,
    text: `${text}\n\n—\nSie erhalten diese E-Mail, weil Sie für unseren Newsletter angemeldet sind. Mit einem Klick abmelden: ${url}`,
    headers: { "List-Unsubscribe": `<${url}>` },
  };
}

export function notifyNewsletterWelcome(email: string) {
  sendMailInBackground(newsletterMessage(email, "Anmeldung zum Newsletter bestätigt", "Vielen Dank! Sie erhalten unsere Angebote und Neuigkeiten maximal einmal pro Monat.", "newsletter-bienvenue"));
}
