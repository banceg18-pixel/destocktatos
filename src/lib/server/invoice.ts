import "server-only";
import type { Order, OrderItem, User } from "@prisma/client";
import type { SiteSettings } from "@/lib/cms/types";
import { transferLines, type BankDetails } from "@/lib/bank";
import { company, legalLines } from "@/lib/brand";
import { PdfDoc } from "./pdf";

const eur = (cents: number) => `${(cents / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const METHODS: Record<string, string> = {
  piedDuCamion: "Lieferung bis Bordsteinkante",
  livraisonPiece: "Lieferung in den Raum Ihrer Wahl",
  installation: "Lieferung mit Installation",
};
const PAID_WITH: Record<string, string> = {
  virement: "per Banküberweisung",
  stripe: "mit Kreditkarte",
  sur_place: "bei Übergabe",
};
const PAID_STATUSES = ["PAYEE", "EN_PREPARATION", "EXPEDIEE", "LIVREE"];
const RED: [number, number, number] = [0.85, 0.11, 0.11];
const GREY: [number, number, number] = [0.4, 0.4, 0.4];

interface Addr {
  fullName?: string;
  name?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  phone?: string;
}

export interface InvoiceStore {
  name: string;
  address: string;
  city: string;
  email: string;
  phone: string;
  /** Société qui exploite le site (vendeur) et ses mentions légales obligatoires. */
  seller?: string;
  legal?: [string, string];
}

/** Découpe un texte en lignes d'au plus `max` caractères (PDF sans retour à la ligne automatique). */
function wrap(text: string, max: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line && (line + " " + word).length > max) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  return line ? [...lines, line] : lines;
}

export function invoiceNumber(o: Pick<Order, "number">) {
  return `FAC-${o.number.replace(/^TAT-/, "")}`;
}

export function quoteNumber(o: Pick<Order, "number">) {
  return `DEV-${o.number.replace(/^TAT-/, "")}`;
}

/** Coordonnées du magasin imprimées sur la facture. */
export function invoiceStore(s: SiteSettings): InvoiceStore {
  return {
    name: s.siteName,
    address: s.addressLine,
    city: `${s.postalCode} ${s.city}, ${s.country}`,
    email: s.email,
    phone: s.phone,
    seller: company(s).name === s.siteName ? undefined : company(s).name,
    legal: legalLines(s),
  };
}

/** Facture : uniquement une fois la commande payée. */
export function invoiceAvailable(o: Pick<Order, "status" | "paidAt">) {
  return PAID_STATUSES.includes(o.status) && !!o.paidAt;
}

/** Devis : dès la confirmation (paiement attendu), avec les informations de paiement ; puis toujours consultable. */
export function quoteAvailable(o: Pick<Order, "status" | "paidAt">) {
  return o.status === "EN_ATTENTE_VIREMENT" || invoiceAvailable(o);
}

/** Document d'une commande : la facture si elle est payée, sinon le devis. */
export const documentKind = (o: Pick<Order, "status" | "paidAt">): "facture" | "devis" => (invoiceAvailable(o) ? "facture" : "devis");

/**
 * Facture (ou devis) PDF d'une commande, TVA 20 % incluse dans les prix TTC. Tant que le virement est
 * attendu, le document porte le montant, la référence et les coordonnées bancaires du règlement.
 */
export function buildInvoicePdf(
  order: Order & { items: OrderItem[] },
  user: Pick<User, "name" | "email">,
  store: InvoiceStore,
  bank: BankDetails | null = null,
  kind: "facture" | "devis" = "facture",
) {
  const doc = new PdfDoc();
  const W = doc.width;
  const awaitingTransfer = order.status === "EN_ATTENTE_VIREMENT" && !order.paidAt;
  let y = doc.height - 60;
  doc.text(40, y, store.name.toUpperCase(), 20, true);
  doc.text(W - 230, y + 6, kind === "devis" ? "ANGEBOT" : "RECHNUNG", 20, true);
  doc.text(W - 230, y - 12, `Nr. ${kind === "devis" ? quoteNumber(order) : invoiceNumber(order)}`, 10);
  y -= 40;
  doc.text(40, y, store.seller ? `${store.name} — ${store.seller}` : store.name, 10, true);
  doc.text(40, y - 14, store.address, 9);
  doc.text(40, y - 26, store.city, 9);
  doc.text(40, y - 38, `${store.email} — ${store.phone}`, 9);
  doc.text(W - 230, y, `Datum: ${order.createdAt.toLocaleDateString("de-DE")}`, 9);
  doc.text(W - 230, y - 14, `Bestellung: ${order.number}`, 9);
  if (order.paidAt) doc.text(W - 230, y - 28, `Bezahlt am ${order.paidAt.toLocaleDateString("de-DE")} ${PAID_WITH[order.paymentProvider ?? ""] ?? ""}`.trim(), 9, true);
  else if (awaitingTransfer) doc.text(W - 230, y - 28, "Per Banküberweisung vor Lieferung zu bezahlen", 9, true, RED);

  y -= 70;
  const billing = (order.billingAddress ?? order.shippingAddress ?? {}) as Addr;
  doc.text(40, y, "Rechnungsempfänger", 10, true);
  doc.text(40, y - 14, billing.fullName || billing.name || user.name, 9);
  if (billing.address) doc.text(40, y - 26, billing.address, 9);
  if (billing.postalCode) doc.text(40, y - 38, `${billing.postalCode} ${billing.city ?? ""}`, 9);
  doc.text(40, y - 50, user.email, 9);
  const ship = order.shippingAddress as Addr | null;
  doc.text(320, y, order.isPickupInStore ? "Selbstabholung" : "Lieferung", 10, true);
  if (order.isPickupInStore) doc.text(320, y - 14, `${store.address}, ${store.city}`, 9);
  else if (ship) {
    doc.text(320, y - 14, ship.fullName ?? "", 9);
    doc.text(320, y - 26, ship.address ?? "", 9);
    doc.text(320, y - 38, `${ship.postalCode ?? ""} ${ship.city ?? ""}`, 9);
  }

  y -= 80;
  doc.rect(40, y - 4, W - 80, 18, [0.95, 0.95, 0.95]);
  doc.text(46, y, "Artikel", 9, true);
  doc.text(340, y, "Menge", 9, true);
  doc.text(390, y, "Einzelpreis (brutto)", 9, true);
  doc.text(W - 110, y, "Gesamt (brutto)", 9, true);
  y -= 20;
  for (const it of order.items) {
    if (y < 140) {
      doc.addPage();
      y = doc.height - 60;
    }
    const title = it.titre.length > 52 ? `${it.titre.slice(0, 50)}…` : it.titre;
    doc.text(46, y, title, 9);
    doc.text(46, y - 11, it.marque, 8, false, GREY);
    doc.text(345, y, String(it.quantity), 9);
    doc.text(390, y, eur(it.unitPriceCents), 9);
    doc.text(W - 110, y, eur(it.lineTotalCents), 9);
    y -= 26;
    doc.line(40, y + 8, W - 40, y + 8);
  }
  y -= 10;
  const row = (label: string, value: string, bold = false) => {
    doc.text(330, y, label, 9, bold);
    doc.text(W - 110, y, value, 9, bold);
    y -= 15;
  };
  row("Zwischensumme", eur(order.subtotalCents));
  if (order.discountCents > 0) row(`Rabatt${order.couponCode ? ` (${order.couponCode})` : ""}`, `-${eur(order.discountCents)}`);
  row(order.isPickupInStore ? "Selbstabholung" : METHODS[order.deliveryMethod ?? ""] ?? "Lieferung", order.isPickupInStore || order.deliveryFeeCents === 0 ? "Kostenlos" : eur(order.deliveryFeeCents));
  const ht = Math.round(order.totalCents / 1.2);
  row("Nettobetrag", eur(ht));
  row("USt. 20 %", eur(order.totalCents - ht));
  row(awaitingTransfer ? "Bruttobetrag zu zahlen" : "Bruttobetrag", eur(order.totalCents), true);

  if (awaitingTransfer) {
    // Demande de règlement : montant, communication, numéro de commande et coordonnées bancaires.
    const { rows: lines, note } = transferLines(eur(order.totalCents), order.number, bank);
    const noteLines = wrap(note, 95);
    const h = 34 + lines.length * 15 + noteLines.length * 12;
    y -= 20;
    if (y - h < 100) {
      doc.addPage();
      y = doc.height - 60;
    }
    doc.rect(40, y - h + 14, W - 80, h, [0.95, 0.95, 0.95]);
    doc.text(52, y, "Zahlung per Banküberweisung, vor der Lieferung", 11, true);
    y -= 20;
    for (const [label, value] of lines) {
      doc.text(52, y, label, 9, false, GREY);
      doc.text(190, y, value, 9, true);
      y -= 15;
    }
    for (const line of noteLines) {
      doc.text(52, y - 2, line, 9);
      y -= 12;
    }
  }
  // Coordonnées bancaires sur chaque facture, payée ou non.
  if (bank) {
    doc.line(40, 88, W - 40, 88);
    doc.text(40, 76, `Bankverbindung — zuständige Abteilung: ${bank.service} — Kontoinhaber: ${bank.holder}`, 8, true);
    doc.text(40, 65, `${bank.bank ? `${bank.bank} — ` : ""}IBAN ${bank.iban}${bank.bic ? ` (BIC ${bank.bic})` : ""}${bank.reference ? ` — Verwendungszweck: ${bank.reference}` : ""}`, 8);
  }
  if (store.legal) {
    doc.text(40, 40, store.legal[0], 7, false, GREY);
    doc.text(40, 31, store.legal[1], 7, false, GREY);
  }
  doc.text(
    40,
    52,
    kind === "devis"
      ? `Angebot zur Bestellung ${order.number}, gemäß unseren Allgemeinen Geschäftsbedingungen.`
      : "Vielen Dank für Ihr Vertrauen. Garantie und Bedingungen: siehe unsere Allgemeinen Geschäftsbedingungen.",
    8,
    false,
    GREY,
  );
  return doc.toBuffer();
}
