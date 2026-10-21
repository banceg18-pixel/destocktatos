import "server-only";
import { createAssistant, faqKnowledge, siteKnowledge, type Assistant, type AssistantReply } from "@/lib/chat/assistant";
import { getAvailableBrands, getCategories, getSousCategories } from "@/lib/catalog/repository";
import { getFaq, getSiteSettings } from "@/lib/cms";
import { memo } from "./memo";
import { syncCaches } from "./sync-version";

export const DEFAULT_ASSISTANT_NAME = "Assistant Destocktatos";
export const DEFAULT_ASSISTANT_WELCOME =
  "Bonjour ! Je suis l'assistant de Destocktatos. Posez-moi vos questions : livraison, paiement, suivi de commande, retours, garantie…";

/** Réglages de l'assistant (WordPress → Réglages → Site et magasin → Assistant du site). */
export async function assistantSettings() {
  const s = await getSiteSettings();
  return {
    enabled: s.chatEnabled !== "0",
    botName: s.chatBotName?.trim() || DEFAULT_ASSISTANT_NAME,
    welcome: s.chatWelcome?.trim() || DEFAULT_ASSISTANT_WELCOME,
  };
}

/**
 * Base de réponses : informations du magasin, rayons du catalogue et FAQ WordPress. Reconstruite
 * dès qu'un contenu WordPress change (préfixe « wp: », voir sync-version.ts), sinon toutes les 5 min.
 */
async function build(): Promise<Assistant> {
  const [s, faq, categories, brands, opts] = await Promise.all([getSiteSettings(), getFaq().catch(() => []), getCategories(), getAvailableBrands(), assistantSettings()]);
  const sousCategories = getSousCategories();
  const store = {
    siteName: s.siteName || "Destocktatos",
    phone: s.phone,
    email: s.email,
    hours: s.hours,
    storeHours: s.storeHours,
    address: [s.addressLine, [s.postalCode, s.city].filter(Boolean).join(" ")].filter(Boolean).join(", "),
  };
  const rayons = categories.map((c) => ({ nom: c.nom, slug: c.slug, count: c.count ?? 0, sousCategories: sousCategories[c.nom] ?? [] }));
  return createAssistant([...siteKnowledge(store, rayons, brands), ...faqKnowledge(faq)], opts);
}

export async function assistantReply(question: string): Promise<AssistantReply> {
  await syncCaches();
  return (await memo("wp:assistant", 5 * 60_000, build)).reply(question);
}
