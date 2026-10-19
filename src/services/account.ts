import { apiFetch } from "./http";
import type { ShippingAddress } from "@/types/cart";

export function registerAccount(payload: { email: string; mdp: string; mdpv: string }) {
  return apiFetch<{ message: string }>("/api/auth/register", { method: "POST", json: payload });
}

export function requestPasswordReset(email: string) {
  return apiFetch<{ message: string }>("/api/auth/forgot-password", { method: "POST", json: { email } });
}

export function resetPassword(token: string, mdp: string) {
  return apiFetch<{ message: string }>("/api/auth/reset-password", { method: "POST", json: { token, mdp } });
}

export type SavedAddress = Required<Pick<ShippingAddress, "_id">> & ShippingAddress;

export function fetchAddresses() {
  return apiFetch<{ addresses: SavedAddress[] }>("/api/user/addresses");
}

export function fetchAddress(id: string) {
  return apiFetch<{ address: SavedAddress }>(`/api/user/addresses/${id}`);
}

export function createAddress(address: Omit<ShippingAddress, "_id">) {
  return apiFetch<{ address: SavedAddress; message: string }>("/api/user/addresses", { method: "POST", json: address });
}

export function updateAddress(id: string, address: Omit<ShippingAddress, "_id">) {
  return apiFetch<{ address: SavedAddress; message: string }>(`/api/user/addresses/${id}`, { method: "PUT", json: address });
}

export function deleteAddress(id: string) {
  return apiFetch<{ message: string }>(`/api/user/addresses/${id}`, { method: "DELETE" });
}

export function setDefaultAddress(id: string) {
  return apiFetch<{ message: string }>(`/api/user/addresses/${id}/default`, { method: "PUT" });
}

export function addressSuggestions(q: string) {
  return apiFetch<{ suggestions: { label: string; address: string; postalCode: string; city: string }[] }>(
    `/api/addresses/suggestions?q=${encodeURIComponent(q)}`,
  );
}

export function updateProfile(name: string) {
  return apiFetch<{ name: string }>("/api/users/me", { method: "PATCH", json: { name } });
}

export function changePassword(payload: { current?: string; mdp: string; mdpv: string }) {
  return apiFetch<{ message: string }>("/api/users/me/password", { method: "POST", json: payload });
}

export function deleteAccount(confirm: string) {
  return apiFetch<{ deleted: true }>("/api/users/me", { method: "DELETE", json: { confirm } });
}
