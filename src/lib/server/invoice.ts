import "server-only";
import type { Order, OrderItem, User } from "@prisma/client";
import type { SiteSettings } from "@/lib/cms/types";
import type { BankDetails } from "@/lib/bank";
import { PdfDoc } from "./pdf";

const eur = (cents: number) => `${(cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const METHODS: Record<string, string> = {
  piedDuCamion: "Livraison au pied du camion",
  livraisonPiece: "Livraison pièce au choix",
  installation: "Livraison et installation",
};
const PAID_WITH: Record<string, string> = {
  virement: "par virement bancaire",
  stripe: "par carte bancaire",
  sur_place: "à la remise de la commande",
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
}

export function invoiceNumber(o: Pick<Order, "number">) {
  return `FAC-${o.number.replace(/^TAT-/, "")}`;
}

/** Coordonnées du magasin imprimées sur la facture. */
export function invoiceStore(s: SiteSettings): InvoiceStore {
  return { name: s.siteName, address: s.addressLine, city: `${s.postalCode} ${s.city}, ${s.country}`, email: s.email, phone: s.phone };
}

/**
 * Facture disponible : commande payée, ou en attente de virement (elle porte alors les coordonnées
 * bancaires et la référence à indiquer, et sert de demande de règlement).
 */
export function invoiceAvailable(o: Pick<Order, "status" | "paidAt">) {
  return (PAID_STATUSES.includes(o.status) && !!o.paidAt) || o.status === "EN_ATTENTE_VIREMENT";
}

/** Facture PDF d'une commande (TVA 20 % incluse dans les prix TTC). */
export function buildInvoicePdf(order: Order & { items: OrderItem[] }, user: Pick<User, "name" | "email">, store: InvoiceStore, bank: BankDetails | null = null) {
  const doc = new PdfDoc();
  const W = doc.width;
  const awaitingTransfer = order.status === "EN_ATTENTE_VIREMENT" && !order.paidAt;
  let y = doc.height - 60;
  doc.text(40, y, store.name.toUpperCase(), 20, true);
  doc.text(W - 230, y + 6, "FACTURE", 20, true);
  doc.text(W - 230, y - 12, `N° ${invoiceNumber(order)}`, 10);
  y -= 40;
  doc.text(40, y, store.name, 10, true);
  doc.text(40, y - 14, store.address, 9);
  doc.text(40, y - 26, store.city, 9);
  doc.text(40, y - 38, `${store.email} — ${store.phone}`, 9);
  doc.text(W - 230, y, `Date : ${order.createdAt.toLocaleDateString("fr-FR")}`, 9);
  doc.text(W - 230, y - 14, `Commande : ${order.number}`, 9);
  if (order.paidAt) doc.text(W - 230, y - 28, `Payée le ${order.paidAt.toLocaleDateString("fr-FR")} ${PAID_WITH[order.paymentProvider ?? ""] ?? ""}`.trim(), 9, true);
  else if (awaitingTransfer) doc.text(W - 230, y - 28, "À régler par virement avant livraison", 9, true, RED);

  y -= 70;
  const billing = (order.billingAddress ?? order.shippingAddress ?? {}) as Addr;
  doc.text(40, y, "Facturé à", 10, true);
  doc.text(40, y - 14, billing.fullName || billing.name || user.name, 9);
  if (billing.address) doc.text(40, y - 26, billing.address, 9);
  if (billing.postalCode) doc.text(40, y - 38, `${billing.postalCode} ${billing.city ?? ""}`, 9);
  doc.text(40, y - 50, user.email, 9);
  const ship = order.shippingAddress as Addr | null;
  doc.text(320, y, order.isPickupInStore ? "Retrait en magasin" : "Livraison", 10, true);
  if (order.isPickupInStore) doc.text(320, y - 14, `${store.address}, ${store.city}`, 9);
  else if (ship) {
    doc.text(320, y - 14, ship.fullName ?? "", 9);
    doc.text(320, y - 26, ship.address ?? "", 9);
    doc.text(320, y - 38, `${ship.postalCode ?? ""} ${ship.city ?? ""}`, 9);
  }

  y -= 80;
  doc.rect(40, y - 4, W - 80, 18, [0.95, 0.95, 0.95]);
  doc.text(46, y, "Article", 9, true);
  doc.text(340, y, "Qté", 9, true);
  doc.text(390, y, "Prix unitaire TTC", 9, true);
  doc.text(W - 110, y, "Total TTC", 9, true);
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
  row("Sous-total", eur(order.subtotalCents));
  if (order.discountCents > 0) row(`Réduction${order.couponCode ? ` (${order.couponCode})` : ""}`, `-${eur(order.discountCents)}`);
  row(order.isPickupInStore ? "Retrait en magasin" : METHODS[order.deliveryMethod ?? ""] ?? "Livraison", order.isPickupInStore || order.deliveryFeeCents === 0 ? "Offerte" : eur(order.deliveryFeeCents));
  const ht = Math.round(order.totalCents / 1.2);
  row("Total HT", eur(ht));
  row("TVA 20 %", eur(order.totalCents - ht));
  row(awaitingTransfer ? "Total TTC à régler" : "Total TTC", eur(order.totalCents), true);

  if (awaitingTransfer) {
    // Demande de règlement : montant, référence et coordonnées bancaires du virement.
    const lines: [string, string][] = [
      ["Montant à virer", eur(order.totalCents)],
      ["Référence à indiquer", order.number],
      ...(bank
        ? ([["Titulaire du compte", bank.holder], ...(bank.bank ? [["Banque", bank.bank]] : []), ["IBAN", bank.iban], ...(bank.bic ? [["BIC", bank.bic]] : [])] as [string, string][])
        : []),
    ];
    const h = 46 + lines.length * 15 + (bank ? 0 : 15);
    y -= 20;
    if (y - h < 80) {
      doc.addPage();
      y = doc.height - 60;
    }
    doc.rect(40, y - h + 14, W - 80, h, [0.95, 0.95, 0.95]);
    doc.text(52, y, "Règlement par virement bancaire, avant livraison", 11, true);
    y -= 20;
    for (const [label, value] of lines) {
      doc.text(52, y, label, 9, false, GREY);
      doc.text(190, y, value, 9, true);
      y -= 15;
    }
    if (!bank) {
      doc.text(52, y, "Nos coordonnées bancaires vous sont communiquées par email.", 9);
      y -= 15;
    }
    doc.text(52, y - 2, "Votre commande est préparée et livrée dès réception du virement.", 9);
  }
  doc.text(40, 60, "Merci pour votre confiance. Garantie et conditions : voir nos conditions générales de vente.", 8, false, GREY);
  return doc.toBuffer();
}
