import type { SiteSettings } from "@/lib/cms/types";

/** Messages non vides du bandeau du haut de page (aucun : pas de bandeau). */
export function bannerMessagesOf(settings: SiteSettings): string[] {
  return [settings.bannerMessage1, settings.bannerMessage2].map((m) => m?.trim() ?? "").filter(Boolean);
}
