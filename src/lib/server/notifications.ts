import "server-only";
import crypto from "node:crypto";
import type { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatEuros, toEuros } from "@/lib/money";
import { SITE_URL } from "@/lib/seo";
import { getSiteSettings } from "@/lib/cms";
import type { SiteSettings } from "@/lib/cms/types";
import { bankDetailsOf, type BankDetails } from "@/lib/bank";
import { buildInvoicePdf, invoiceAvailable, invoiceNumber, invoiceStore } from "./invoice";
import { sendMail, sendMailInBackground, STORE_EMAIL } from "./mailer";

/**
 * Emails transactionnels : confirmation de commande (client et magasin, facture PDF jointe), suivi de statut,
 * bienvenue, newsletter. Texte simple et lisible ; envoi par SMTP ou outbox (voir mailer.ts).
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
  return prisma.order.findUnique({ where: { id: orderId }, include: { items: true, user: { select: { name: true, email: true } } } });
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
function invoiceAttachments(o: FullOrder, s: SiteSettings | null) {
  if (!s || !invoiceAvailable(o)) return [];
  return [{ filename: `facture_${invoiceNumber(o)}.pdf`, content: buildInvoicePdf(o, o.user, invoiceStore(s), bankDetailsOf(s)), contentType: "application/pdf" }];
}

/** Montant, référence et coordonnées bancaires du virement attendu. */
function transferDetails(o: FullOrder, bank: BankDetails | null) {
  return [
    `Montant : ${eur(o.totalCents)}`,
    `Référence à indiquer : ${o.number}`,
    ...(bank ? [`Titulaire du compte : ${bank.holder}`, ...(bank.bank ? [`Banque : ${bank.bank}`] : []), `IBAN : ${bank.iban}`, ...(bank.bic ? [`BIC : ${bank.bic}`] : [])] : []),
  ].join("\n");
}

/**
 * Commande payée, ou confirmée avec règlement par virement : récapitulatif au client (facture PDF
 * jointe, avec les coordonnées bancaires s'il reste à payer) et alerte au magasin.
 */
export async function notifyOrderPaid(orderId: string) {
  const o = await loadOrder(orderId);
  if (!o) return;
  const s = await getSiteSettings().catch(() => null);
  const bank = bankDetailsOf(s);
  const awaitingTransfer = o.status === "EN_ATTENTE_VIREMENT" && !o.paidAt;
  const attachments = invoiceAttachments(o, s);
  const where = o.isPickupInStore
    ? `Retrait en magasin : ${s ? `${s.addressLine}, ${s.postalCode} ${s.city} (${s.storeHours})` : "à l'adresse du magasin"}. Nous vous prévenons dès que votre commande est prête.`
    : `Adresse de livraison :
${addressLines(o.shippingAddress as AddressJson)}

Nous vous appelons pour convenir du jour et du créneau de livraison.`;
  const intro = awaitingTransfer
    ? `Merci pour votre commande ${o.number} : elle est enregistrée et vos articles sont réservés.

Pour la valider, réglez ${eur(o.totalCents)} par virement bancaire :
${transferDetails(o, bank)}${bank ? "" : "\n\nNos coordonnées bancaires vous sont envoyées très rapidement par email."}

Indiquez bien la référence ${o.number} dans le libellé du virement. Votre commande est préparée et livrée dès réception du virement.`
    : `Merci pour votre commande ${o.number} : le paiement de ${eur(o.totalCents)} a bien été reçu.`;
  await sendMail({
    to: o.user.email,
    tag: "commande-confirmation",
    subject: awaitingTransfer ? `Commande ${o.number} : facture et coordonnées de paiement` : `Commande ${o.number} confirmée`,
    text: `Bonjour ${o.user.name},

${intro}${attachments.length ? "\n\nVotre facture est jointe à cet email (PDF)." : ""}

${summary(o)}

${where}

Suivre la commande et retrouver la facture : ${SITE_URL}/compte/commandes

${await signature()}`,
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
    text: `Client : ${o.user.name} <${o.user.email}>
${o.isPickupInStore ? "Retrait en magasin" : `Livraison :
${addressLines(o.shippingAddress as AddressJson)}`}

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
  const attachments = invoice ? invoiceAttachments(o, await getSiteSettings().catch(() => null)) : [];
  await sendMail({
    to: o.user.email,
    tag: `commande-${status.toLowerCase()}`,
    subject,
    text: `Bonjour ${o.user.name},\n\n${body}\n\nCommande ${o.number} — ${eur(o.totalCents)}\nDétail et facture : ${SITE_URL}/compte/commandes\n\n${await signature()}`,
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
