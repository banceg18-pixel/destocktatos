import { apiFetch } from "./http";

export interface ContactPayload {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export function sendContact(payload: ContactPayload) {
  return apiFetch<{ message: string; id: string }>("/api/contact", { method: "POST", json: payload });
}

export function sendServiceRequest(payload: Record<string, unknown>) {
  return apiFetch<{ message: string; id: string }>("/api/contact/services", { method: "POST", json: payload });
}

export function subscribeNewsletter(email: string) {
  return apiFetch<{ message: string }>("/api/newsletter/subscribe", { method: "POST", json: { email } });
}

export function createTicket(payload: Record<string, unknown>) {
  return apiFetch<{ message: string; ticketNumber: string; id: string }>("/api/tickets/create", { method: "POST", json: payload });
}

export async function uploadTicketImages(files: File[]) {
  const fd = new FormData();
  files.forEach((f) => fd.append("images", f));
  return apiFetch<{ images: { url: string; name: string }[] }>("/api/tickets/images", { method: "POST", body: fd });
}

export function unsubscribeNewsletter(email: string, token: string) {
  return apiFetch<{ message: string }>("/api/newsletter/unsubscribe", { method: "POST", json: { email, token } });
}
