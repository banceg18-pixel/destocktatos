import "server-only";
import type { Order, OrderItem, User } from "@prisma/client";
import { PdfDoc } from "./pdf";

const eur = (cents: number) => `${(cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const METHODS: Record<string, string> = {
  piedDuCamion: "Livraison au pied du camion",
  livraisonPiece: "Livraison pièce au choix",
  installation: "Livraison et installation",
};

interface Addr {
  fullName?: string;
  name?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  phone?: string;
}

export function invoiceNumber(o: Pick<Order, "number">) {
  return `FAC-${o.number.replace(/^TAT-/, "")}`;
}

/** Facture PDF d'une commande payée (TVA 20 % incluse dans les prix TTC). */
export function buildInvoicePdf(order: Order & { items: OrderItem[] }, user: Pick<User, "name" | "email">, store: { name: string; address: string; city: string; email: string; phone: string }) {
  const doc = new PdfDoc();
  const W = doc.width;
  let y = doc.height - 60;
  doc.rect(40, y - 8, 30, 30, [0.792, 0.541, 0.016]);
  doc.text(48, y, "T", 22, true, [1, 1, 1]);
  doc.text(75, y, "Atos", 22, true);
  doc.text(W - 230, y + 6, "FACTURE", 20, true);
  doc.text(W - 230, y - 12, `N° ${invoiceNumber(order)}`, 10);
  y -= 40;
  doc.text(40, y, store.name, 10, true);
  doc.text(40, y - 14, store.address, 9);
  doc.text(40, y - 26, store.city, 9);
  doc.text(40, y - 38, `${store.email} — ${store.phone}`, 9);
  const date = (order.paidAt ?? order.createdAt).toLocaleDateString("fr-FR");
  doc.text(W - 230, y, `Date : ${date}`, 9);
  doc.text(W - 230, y - 14, `Commande : ${order.number}`, 9);
  if (order.paymentProvider === "sur_place") doc.text(W - 230, y - 28, "Réglée à la remise de la commande", 9);

  y -= 70;
  const billing = (order.billingAddress ?? order.shippingAddress ?? {}) as Addr;
  doc.text(40, y, "Facturé à", 10, true);
  doc.text(40, y - 14, billing.fullName || billing.name || user.name, 9);
  if (billing.address) doc.text(40, y - 26, billing.address, 9);
  if (billing.postalCode) doc.text(40, y - 38, `${billing.postalCode} ${billing.city ?? ""}`, 9);
  doc.text(40, y - 50, user.email, 9);
  const ship = order.shippingAddress as Addr | null;
  doc.text(320, y, order.isPickupInStore ? "Retrait en magasin" : "Livré à", 10, true);
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
    doc.text(46, y - 11, it.marque, 8, false, [0.4, 0.4, 0.4]);
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
  row(order.isPickupInStore ? "Retrait en magasin" : METHODS[order.deliveryMethod ?? ""] ?? "Livraison", order.isPickupInStore ? "Gratuit" : eur(order.deliveryFeeCents));
  const ht = Math.round(order.totalCents / 1.2);
  row("Total HT", eur(ht));
  row("TVA 20 %", eur(order.totalCents - ht));
  row("Total TTC", eur(order.totalCents), true);
  doc.text(40, 60, "Merci pour votre confiance. Garantie et conditions : voir nos conditions générales de vente.", 8, false, [0.4, 0.4, 0.4]);
  return doc.toBuffer();
}
