import "server-only";
import crypto from "node:crypto";

/**
 * Client d'initiation de virement Bridge (Bridge API / Open Banking PISP).
 * Connecté à l'API Bridge officielle (https://api.bridgeapi.io/v3) dès que BRIDGE_CLIENT_ID et
 * BRIDGE_CLIENT_SECRET sont configurés. Sinon, active le simulateur de déclenchement bancaire
 * (adapté aux banques allemandes) pour tester le parcours de bout en bout.
 */

const API_URL = process.env.BRIDGE_API_URL || "https://api.bridgeapi.io";
const VERSION = process.env.BRIDGE_VERSION || "2025-01-15";
const CLIENT_ID = process.env.BRIDGE_CLIENT_ID || "";
const CLIENT_SECRET = process.env.BRIDGE_CLIENT_SECRET || "";
const WEBHOOK_SECRET = process.env.BRIDGE_WEBHOOK_SECRET || "bridge-webhook-secret-destocktatos";

export const BRIDGE_BENEFICIARY = {
  name: process.env.BRIDGE_BENEFICIARY_NAME || "Bernard Alexis Chabaud",
  iban: (process.env.BRIDGE_BENEFICIARY_IBAN || "DE53310108339914082074").replace(/\s+/g, ""),
  bic: process.env.BRIDGE_BENEFICIARY_BIC || "SCFBDE33XXX",
  bank: "Santander Consumer Bank",
};

export function isLiveBridge(): boolean {
  return Boolean(CLIENT_ID && CLIENT_SECRET);
}

export function bridgeMode(): "live" | "sandbox-sim" {
  return isLiveBridge() ? "live" : "sandbox-sim";
}

export interface BridgePaymentRequestParams {
  orderId: string;
  orderNumber: string;
  amount: number; // Montant en euros
  user: { firstName: string; lastName: string; email?: string };
  bankId?: string;
  callbackUrl: string;
  appOrigin: string;
}

export interface BridgePaymentRequestResult {
  id: string;
  url: string;
  mode: "live" | "sandbox-sim";
}

/**
 * Crée une demande de paiement Bridge (virement bancaire direct).
 * En mode réel : POST /v3/payment/payment-requests chez Bridge.
 * En mode bac à sable / simulateur : génère un lien vers notre simulateur de banque allemande.
 */
export async function createBridgePaymentRequest(p: BridgePaymentRequestParams): Promise<BridgePaymentRequestResult> {
  if (!isLiveBridge()) {
    const simId = `pr_sim_${crypto.randomBytes(6).toString("hex")}`;
    const token = signBridgeToken({ orderId: p.orderId, orderNumber: p.orderNumber, amount: p.amount, bankId: p.bankId, user: p.user });
    return {
      id: simId,
      url: `${p.appOrigin}/bank-sim?token=${encodeURIComponent(token)}&bank=${encodeURIComponent(p.bankId || "sparkasse")}`,
      mode: "sandbox-sim",
    };
  }

  const [cents] = [Math.round(p.amount * 100)];
  const body: Record<string, unknown> = {
    callback_url: p.callbackUrl,
    client_reference: p.orderId,
    user: {
      first_name: p.user.firstName || "Kunde",
      last_name: p.user.lastName || "Destocktatos",
      external_reference: p.orderId,
    },
    transactions: [
      {
        amount: (cents / 100).toFixed(2),
        currency: "EUR",
        label: `Destocktatos ${p.orderNumber}`,
        client_reference: p.orderId,
        end_to_end_id: p.orderNumber.replace(/[^A-Za-z0-9]/g, "").slice(0, 35),
        beneficiary: {
          company_name: BRIDGE_BENEFICIARY.name,
          iban: BRIDGE_BENEFICIARY.iban,
        },
      },
    ],
  };

  const res = await fetch(`${API_URL}/v3/payment/payment-requests`, {
    method: "POST",
    headers: {
      "Bridge-Version": VERSION,
      "Client-Id": CLIENT_ID,
      "Client-Secret": CLIENT_SECRET,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Bridge payment-request failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { id: string; url: string };
  return { id: data.id, url: data.url, mode: "live" };
}

/* ------------------------------------------------------------------------------- Signatures Webhook */

export function verifyBridgeWebhookSignature(rawBody: string, header: string | null): boolean {
  if (!header) return false;
  const expected = crypto.createHmac("sha256", WEBHOOK_SECRET).update(rawBody, "utf8").digest("hex").toUpperCase();
  const provided = header
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.startsWith("v1="))
    .map((p) => p.slice(3).toUpperCase());

  const expBuf = Buffer.from(expected);
  return provided.some((sig) => {
    const sigBuf = Buffer.from(sig);
    return sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);
  });
}

/* ------------------------------------------------------------------------------- Jeton sécurisé Simulateur */

const TOKEN_SECRET = process.env.NEXTAUTH_SECRET || "destocktatos-bridge-sim-secret-salt";

export interface BridgeSimPayload {
  orderId: string;
  orderNumber: string;
  amount: number;
  bankId?: string;
  user: { firstName: string; lastName: string; email?: string };
  exp?: number;
}

export function signBridgeToken(payload: BridgeSimPayload): string {
  const data = JSON.stringify({ ...payload, exp: Date.now() + 60 * 60 * 1000 });
  const b64 = Buffer.from(data, "utf8").toString("base64url");
  const hmac = crypto.createHmac("sha256", TOKEN_SECRET).update(b64).digest("base64url");
  return `${b64}.${hmac}`;
}

export function verifyBridgeToken(token: string | null | undefined): BridgeSimPayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [b64, hmac] = parts;
  const expected = crypto.createHmac("sha256", TOKEN_SECRET).update(b64).digest("base64url");
  if (hmac !== expected) return null;
  try {
    const parsed = JSON.parse(Buffer.from(b64, "base64url").toString("utf8")) as BridgeSimPayload;
    if (parsed.exp && parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}
