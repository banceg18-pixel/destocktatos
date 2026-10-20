import { apiFetch } from "./http";
import type { CreateOrderPayload } from "@/types/cart";

export interface OrderDTO {
  _id: string;
  number: string;
  status: "EN_ATTENTE_PAIEMENT" | "EN_ATTENTE_VIREMENT" | "PAYEE" | "EN_PREPARATION" | "EXPEDIEE" | "LIVREE" | "ANNULEE" | "PAIEMENT_ECHOUE";
  createdAt: string;
  paidAt: string | null;
  expiresAt: string | null;
  items: { productId: string; slug: string | null; title: string; marque: string; imagePrincipale: { url: string }; quantity: number; price: number; originalPrice: number }[];
  subtotal: number;
  deliveryFee: number;
  deliveryMethod: "piedDuCamion" | "livraisonPiece" | "installation" | null;
  includeOldItemPickup: boolean;
  deliveryDistance: number;
  isPickupInStore: boolean;
  shippingAddress: { fullName: string; address: string; postalCode: string; city: string; phone: string; additionalInfo?: string; floor?: number } | null;
  billingAddress: Record<string, string> | null;
  appliedCoupon: { code: string; discount: number } | null;
  totalAmount: number;
  paymentProvider: string | null;
  paymentMode: "live" | "test" | null;
}

export function createOrder(payload: CreateOrderPayload) {
  return apiFetch<{ success: true; order: OrderDTO }>("/api/orders/create", { method: "POST", json: payload, timeoutMs: 45_000 });
}

export function fetchLatestOrder() {
  return apiFetch<OrderDTO>("/api/orders/latest");
}

export function fetchOrders() {
  return apiFetch<{ orders: OrderDTO[] }>("/api/orders");
}

export function fetchOrder(id: string) {
  return apiFetch<OrderDTO>(`/api/orders/${id}`);
}

export function cancelOrder(id: string) {
  return apiFetch<{ success: true }>(`/api/orders/${id}/cancel`, { method: "POST" });
}

export function createPaymentIntent() {
  return apiFetch<{ clientSecret: string | null; provider: "stripe" | "virement"; mode: "live" | "test"; bankTransfer: boolean; orderId: string; amount: number }>(
    "/api/checkout/create-payment-intent",
    { method: "POST", json: {}, timeoutMs: 45_000 },
  );
}

export function confirmStripePayment(paymentIntentId: string, billingAddress?: Record<string, string>) {
  return apiFetch<{ status: string; orderId: string; number: string }>("/api/checkout/confirm", {
    method: "POST",
    json: { paymentIntentId, billingAddress },
    timeoutMs: 45_000,
  });
}

/** Confirme la commande avec un règlement par virement bancaire avant livraison. */
export function confirmBankTransfer(orderId: string, billingAddress: Record<string, string>) {
  return apiFetch<{ status: string; orderId: string; number: string }>("/api/checkout/bank-transfer", {
    method: "POST",
    json: { orderId, billingAddress },
    timeoutMs: 45_000,
  });
}

export function invoiceLink(id: string, kind: "download" | "view") {
  return apiFetch<{ success: boolean; downloadUrl?: string; viewUrl?: string; invoiceNumber: string }>(`/api/orders/${id}/${kind}-invoice`);
}

export const ORDER_STATUS_LABELS: Record<OrderDTO["status"], { label: string; className: string }> = {
  EN_ATTENTE_PAIEMENT: { label: "En attente de paiement", className: "border border-warning/50 text-warning" },
  EN_ATTENTE_VIREMENT: { label: "En attente de virement", className: "border border-warning/50 text-warning" },
  PAYEE: { label: "Payée", className: "bg-ink text-paper" },
  EN_PREPARATION: { label: "En préparation", className: "bg-ink text-paper" },
  EXPEDIEE: { label: "En livraison", className: "bg-ink text-paper" },
  LIVREE: { label: "Livrée", className: "bg-success text-paper" },
  ANNULEE: { label: "Annulée", className: "bg-mist text-graphite" },
  PAIEMENT_ECHOUE: { label: "Paiement refusé", className: "border border-danger/50 text-danger" },
};

/** Libellé du statut, adapté au retrait en magasin (« Prête à retirer », « Retirée »). */
export function orderStatusLabel(status: OrderDTO["status"], pickup: boolean) {
  if (pickup && status === "EXPEDIEE") return "Prête à retirer";
  if (pickup && status === "LIVREE") return "Retirée";
  return ORDER_STATUS_LABELS[status].label;
}

export const DELIVERY_LABELS: Record<string, string> = {
  piedDuCamion: "Livraison au pied du camion",
  livraisonPiece: "Livraison pièce au choix",
  installation: "Installation",
};
