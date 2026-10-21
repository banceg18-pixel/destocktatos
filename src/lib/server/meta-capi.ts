import "server-only";
import crypto from "node:crypto";

/**
 * API Conversions de Meta (événements envoyés par le serveur, en complément du Pixel du navigateur).
 * Inactive tant que META_PIXEL_ID et META_CAPI_TOKEN ne sont pas renseignés chez l'hébergeur ;
 * META_GRAPH_VERSION choisit la version de l'API Graph (v21.0 par défaut). Les données personnelles
 * (email, téléphone) sont envoyées hachées (SHA-256), comme l'exige Meta. Jamais bloquant.
 */
const sha = (v: string) => crypto.createHash("sha256").update(v.trim().toLowerCase()).digest("hex");

export function metaConfigured() {
  return !!(process.env.META_PIXEL_ID && process.env.META_CAPI_TOKEN);
}

export async function sendMetaEvent(
  event: "Purchase" | "InitiateCheckout" | "AddPaymentInfo" | "Lead" | "CompleteRegistration",
  data: { eventId?: string; email?: string | null; phone?: string | null; value?: number; currency?: string; url?: string; ip?: string | null; userAgent?: string | null },
) {
  const pixel = process.env.META_PIXEL_ID;
  const token = process.env.META_CAPI_TOKEN;
  if (!pixel || !token) return;
  const version = process.env.META_GRAPH_VERSION || "v21.0";
  const phone = data.phone ? data.phone.replace(/\D/g, "").replace(/^0/, "33") : null;
  const body = {
    data: [
      {
        event_name: event,
        event_time: Math.floor(Date.now() / 1000),
        event_id: data.eventId,
        action_source: "website",
        event_source_url: data.url,
        user_data: {
          ...(data.email ? { em: [sha(data.email)] } : {}),
          ...(phone ? { ph: [sha(phone)] } : {}),
          ...(data.ip ? { client_ip_address: data.ip } : {}),
          ...(data.userAgent ? { client_user_agent: data.userAgent } : {}),
        },
        custom_data: data.value != null ? { value: data.value, currency: data.currency ?? "EUR" } : undefined,
      },
    ],
  };
  try {
    const res = await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(pixel)}/events?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.error("[meta] événement refusé :", res.status, (await res.text()).slice(0, 200));
  } catch (e) {
    console.error("[meta] envoi impossible :", (e as Error).message);
  }
}
