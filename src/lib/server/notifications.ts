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
import { buildInvoicePdf, invoiceAvailable, invoiceNumber, invoiceStore } from "./invoice";
import { button, emailLayout, heading, infoBox, orderTable, para, subheading, type EmailStore } from "./email-layout";
import { ACCOUNT_LINK_TTL_MS, passwordLink } from "./password-link";
import { sendMail, sendMailInBackground, STORE_EMAIL } from "./mailer";

/**
 * Emails transactionnels : confirmation de commande (client et magasin, facture PDF jointe), suivi de statut,
 * bienvenue, newsletter. HTML aux couleurs du site (email-layout.ts) avec sa version texte ; envoi par
 * SMTP ou outbox (voir mailer.ts).
 */

const DELIVERY = { piedDuCamion: "Livraison au pied du camion", livraisonPiece: "Livraison dans la pièce", installation: "Livraison avec installation" } as const;
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
    ? "Retrait en magasin : gratuit"
    : `${DELIVERY[o.deliveryMethod as keyof typeof DELIVERY] ?? "Livraison"}${o.deliveryDistanceKm ? ` (${Math.round(o.deliveryDistanceKm)} km)` : ""}${o.includeOldItemPickup ? ", reprise de l'ancien appareil" : ""} : ${o.deliveryFeeCents ? eur(o.deliveryFeeCents) : "offerte"}`;
  return [
    ...lines,
    "",
    `Sous-total : ${eur(o.subtotalCents)}`,
    ...(o.discountCents ? [`Réduction${o.couponCode ? ` (${o.couponCode})` : ""} : −${eur(o.discountCents)}`] : []),
    delivery,
    `Total : ${eur(o.totalCents)}`,
  ].join("\n");
}

const PAYMENT_LABELS: Record<string, string> = {
  stripe: "carte bancaire en ligne (Stripe)",
  virement: "virement bancaire avant livraison",
  sur_place: "à régler à la livraison ou au retrait",
  test: "simulation (tests automatisés)",
};

/** Facture PDF en pièce jointe (commande payée ou en attente de virement). */
function orderAttachments(o: FullOrder, s: SiteSettings | null) {
  if (!s || !invoiceAvailable(o)) return [];
  return [{ filename: `facture_${invoiceNumber(o)}.pdf`, content: buildInvoicePdf(o, o.user, invoiceStore(s), bankDetailsOf(s)), contentType: "application/pdf" }];
}

const emailStore = (s: SiteSettings | null): EmailStore | null =>
  s ? { name: s.siteName, address: `${s.addressLine}, ${s.postalCode} ${s.city}`, phone: s.phone, email: s.email, legal: legalLines(s) } : null;

/** Lignes du virement attendu : montant, communication, numéro de commande, coordonnées bancaires. */
const transferRows = (o: FullOrder, bank: BankDetails | null) => transferLines(eur(o.totalCents), o.number, bank).rows;

function deliveryLabel(o: FullOrder) {
  if (o.isPickupInStore) return "Retrait en magasin";
  return `${DELIVERY[o.deliveryMethod as keyof typeof DELIVERY] ?? "Livraison"}${o.includeOldItemPickup ? " + reprise de l'ancien appareil" : ""}`;
}

/** Récapitulatif HTML (articles et totaux). */
function summaryTable(o: FullOrder) {
  return orderTable(
    o.items.map((i) => ({ label: `${i.marque} ${i.titre}`.trim(), detail: `Quantité ${i.quantity} · ${eur(i.unitPriceCents)} l'unité`, amount: eur(i.lineTotalCents) })),
    [
      { label: "Sous-total", amount: eur(o.subtotalCents) },
      ...(o.discountCents ? [{ label: `Réduction${o.couponCode ? ` (${o.couponCode})` : ""}`, amount: `−${eur(o.discountCents)}` }] : []),
      { label: deliveryLabel(o), amount: o.deliveryFeeCents ? eur(o.deliveryFeeCents) : "Offerte" },
      { label: "Total TTC", amount: eur(o.totalCents), strong: true },
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
      text: `Retrouvez vos commandes et vos factures dans votre compte : ${url}`,
      html: subheading("Votre espace client") + para("Suivez votre commande et retrouvez vos factures à tout moment dans votre compte.") + button("Me connecter", url),
    };
  }
  const link = await passwordLink(o.userId, ACCOUNT_LINK_TTL_MS, true);
  return {
    text: `Créez votre compte pour suivre votre commande et retrouver vos factures : choisissez simplement votre mot de passe (lien personnel valable 7 jours) :\n${link}`,
    html:
      subheading("Créez votre compte") +
      para("Pour suivre votre commande et retrouver vos factures à tout moment, choisissez simplement votre mot de passe : votre compte est déjà prêt, à votre adresse email.") +
      button("Créer mon compte", link) +
      para("Lien personnel, valable 7 jours.", { muted: true, size: 13 }),
  };
}

/**
 * Commande payée, ou confirmée avec règlement par virement : email au client (récapitulatif, facture
 * PDF jointe avec les informations de paiement, invitation à créer son compte) et alerte au magasin.
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
    ? `Retrait en magasin : ${s ? `${s.addressLine}, ${s.postalCode} ${s.city} (${s.storeHours})` : "à l'adresse du magasin"}. Nous vous prévenons dès que votre commande est prête.`
    : `Adresse de livraison :\n${addressLines(ship)}\n\nNous vous appelons pour convenir du jour et du créneau de livraison.`;
  const docs = attachments.length ? "Votre facture est jointe à cet email (PDF)." : "";
  const transferNote = transferLines(eur(o.totalCents), o.number, bank).note;
  const text = `Bonjour ${o.user.name},

${
  awaitingTransfer
    ? `Merci pour votre commande ${o.number} : elle est enregistrée et vos articles sont réservés.

Pour la valider, réglez ${eur(o.totalCents)} par virement bancaire :
${transferRows(o, bank)
  .map(([l, v]) => `${l} : ${v}`)
  .join("\n")}${bank ? "" : "\n\nNos coordonnées bancaires vous sont envoyées très rapidement par email."}

${transferNote}`
    : `Merci pour votre commande ${o.number} : le paiement de ${eur(o.totalCents)} a bien été reçu.`
}${docs ? `\n\n${docs}` : ""}

${summary(o)}

${where}

${account.text}

${await signature()}`;
  const html = emailLayout({
    store: emailStore(s),
    preheader: awaitingTransfer ? `Commande ${o.number} : réglez ${eur(o.totalCents)} par virement pour la valider.` : `Commande ${o.number} confirmée et payée.`,
    body:
      heading("Merci pour votre commande !") +
      para(`Bonjour ${o.user.name},`) +
      (awaitingTransfer
        ? para(`Votre commande ${o.number} est enregistrée et vos articles sont réservés. Pour la valider, réglez ${eur(o.totalCents)} par virement bancaire.`) +
          infoBox("Virement bancaire à effectuer", transferRows(o, bank), bank ? transferNote : `Nos coordonnées bancaires vous sont envoyées très rapidement par email. ${transferNote}`)
        : para(`Votre commande ${o.number} est confirmée : le paiement de ${eur(o.totalCents)} a bien été reçu.`)) +
      (docs ? para(docs, { muted: true }) : "") +
      subheading("Votre commande") +
      summaryTable(o) +
      subheading(o.isPickupInStore ? "Retrait" : "Livraison") +
      para(o.isPickupInStore ? where : `${addressLines(ship)}`) +
      (o.isPickupInStore ? "" : para("Nous vous appelons pour convenir du jour et du créneau de livraison.", { muted: true })) +
      account.html,
  });
  await sendMail({
    to: o.user.email,
    tag: "commande-confirmation",
    subject: awaitingTransfer ? `Commande ${o.number} : facture et informations de paiement` : `Commande ${o.number} confirmée`,
    text,
    html,
    attachments,
  });
  const storeAction = awaitingTransfer
    ? `, en attente (référence ${o.number}).
À réception du virement, passez la commande à « Payée (virement reçu) » dans WordPress → Boutique → Commandes : le client est prévenu et la commande peut être préparée.${
        bank
          ? ""
          : "\n\nATTENTION : coordonnées bancaires non renseignées, le client ne les a pas reçues. Renseignez l'IBAN dans WordPress → Réglages → Site et magasin, puis envoyez-les-lui en répondant à cet email."
      }`
    : "";
  await sendMail({
    to: STORE_EMAIL,
    replyTo: o.user.email,
    tag: "commande-magasin",
    subject: `Nouvelle commande ${o.number} — ${eur(o.totalCents)}${awaitingTransfer ? " — virement attendu" : ""}`,
    text: `Client : ${o.user.name} <${o.user.email}>${o.user.passwordHash ? "" : " (commande passée sans compte)"}
${o.isPickupInStore ? "Retrait en magasin" : `Livraison :\n${addressLines(ship)}`}

${summary(o)}

Paiement : ${PAYMENT_LABELS[o.paymentProvider ?? ""] ?? o.paymentProvider ?? "—"}${storeAction}`,
    attachments,
  });
}

const STATUS_MAIL: Partial<Record<OrderStatus, (o: FullOrder) => { subject: string; body: string; invoice?: boolean }>> = {
  PAYEE: (o) => ({
    subject: `Virement reçu : commande ${o.number} en préparation`,
    body: `Nous avons bien reçu votre virement de ${eur(o.totalCents)}. Votre commande passe en préparation : ${o.isPickupInStore ? "nous vous prévenons dès qu'elle est prête à retirer." : "nous vous appelons pour convenir du jour et du créneau de livraison."} Votre facture acquittée est jointe à cet email.`,
    invoice: true,
  }),
  EN_PREPARATION: (o) => ({ subject: `Commande ${o.number} en préparation`, body: "Votre commande est en cours de préparation dans notre magasin." }),
  EXPEDIEE: (o) =>
    o.isPickupInStore
      ? { subject: `Commande ${o.number} prête à retirer`, body: "Votre commande est prête : vous pouvez venir la retirer au magasin, muni de votre numéro de commande." }
      : { subject: `Commande ${o.number} en route`, body: "Votre commande a quitté le magasin et sera livrée au créneau convenu. Le livreur vous appelle avant son arrivée." },
  LIVREE: (o) => ({
    subject: `Commande ${o.number} ${o.isPickupInStore ? "retirée" : "livrée"}`,
    body: `Votre commande a bien été ${o.isPickupInStore ? "retirée" : "livrée"}. Sa facture est disponible dans votre espace client. Merci de votre confiance ! Votre avis aide les autres clients : vous pouvez noter vos appareils depuis leur fiche produit.`,
  }),
  ANNULEE: (o) => ({
    subject: `Commande ${o.number} annulée`,
    body: `Votre commande a été annulée.${o.paidAt ? " Le remboursement est effectué sur votre moyen de paiement d'origine sous 5 à 10 jours ouvrés." : ""} Pour toute question, répondez simplement à cet email.`,
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
    text: `Bonjour ${o.user.name},\n\n${body}\n\nCommande ${o.number} — ${eur(o.totalCents)}\nDétail et facture : ${url}\n\n${await signature()}`,
    html: emailLayout({
      store: emailStore(s),
      preheader: body.slice(0, 120),
      body:
        heading(subject) +
        para(`Bonjour ${o.user.name},`) +
        para(body) +
        infoBox(`Commande ${o.number}`, [
          ["Montant", eur(o.totalCents)],
          ["Livraison", deliveryLabel(o)],
        ]) +
        button("Suivre ma commande", url),
    }),
    attachments,
  });
}

export function notifyWelcome(user: { name: string; email: string }) {
  void signature().then((sig) =>
    sendMailInBackground({
      to: user.email,
      tag: "bienvenue",
      subject: "Bienvenue dans votre espace client",
      text: `Bonjour ${user.name},\n\nVotre compte est créé. Vous pouvez y suivre vos commandes, télécharger vos factures et enregistrer vos adresses de livraison : ${SITE_URL}/compte\n\n${sig}`,
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
    text: `${text}\n\n—\nVous recevez cet email car vous êtes inscrit à notre newsletter. Se désinscrire en un clic : ${url}`,
    headers: { "List-Unsubscribe": `<${url}>` },
  };
}

export function notifyNewsletterWelcome(email: string) {
  sendMailInBackground(newsletterMessage(email, "Inscription à la newsletter confirmée", "Merci ! Vous recevrez nos offres et nouveautés, une fois par mois au plus.", "newsletter-bienvenue"));
}
