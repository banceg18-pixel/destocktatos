import "server-only";

/**
 * Adressvorschläge (Autocomplete) über Nominatim (OpenStreetMap, ohne Schlüssel), auf
 * Deutschland beschränkt. Liefert strukturierte Treffer: Adresse, Postleitzahl, Stadt.
 */
const NOMINATIM = "https://nominatim.openstreetmap.org";

interface NomFeature {
  place_id: string | number;
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    house_number?: string;
    road?: string;
    pedestrian?: string;
    postcode?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
  };
}

async function nominatim(path: string) {
  const res = await fetch(`${NOMINATIM}${path}`, {
    // Nominatim exige un User-Agent identifiant l'application (politique OSM).
    headers: { "User-Agent": "Destocktatos/1.0 (https://destocktatos.com)", Accept: "application/json", "Accept-Language": "de" },
    next: { revalidate: 86400 },
  });
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
  return (await res.json()) as NomFeature[];
}

const cityOf = (a: NomFeature["address"]) => a?.city ?? a?.town ?? a?.village ?? a?.municipality ?? "";

export async function suggestAddresses(q: string) {
  const list = await nominatim(
    `/search?format=json&q=${encodeURIComponent(q)}&limit=5&countrycodes=de&addressdetails=1&accept-language=de`,
  );
  return list.map((f) => {
    const a = f.address ?? {};
    const house = a.house_number ? ` ${a.house_number}` : "";
    const street = a.road ?? a.pedestrian ?? "";
    const address = street ? `${street}${house}` : f.display_name.split(",")[0];
    return {
      id: String(f.place_id),
      label: f.display_name.split(",").slice(0, 3).join(",").trim(),
      address,
      postalCode: a.postcode ?? "",
      city: cityOf(a),
    };
  });
}

/** Valide eine Adresse: ausreichende Übereinstimmung beim Suchbegriff (PLZ enthalten). */
export async function validateAddress(address: string, postalCode: string, city: string) {
  const list = await nominatim(
    `/search?format=json&q=${encodeURIComponent(`${address}, ${postalCode} ${city}`)}&limit=3&countrycodes=de&addressdetails=1&accept-language=de`,
  );
  const best = list.find((f) => (f.address?.postcode ?? "") === postalCode) ?? (list.length ? list[0] : null);
  if (!best) return { valid: false as const, error: "Adresse nicht gefunden. Überprüfen Sie Adresse, Postleitzahl und Stadt." };
  const a = best.address ?? {};
  const street = a.road ?? a.pedestrian ?? "";
  return {
    valid: true as const,
    normalizedAddress: {
      address: street ? [street, a.house_number].filter(Boolean).join(" ") : address,
      postalCode: a.postcode ?? postalCode,
      city: cityOf(a) || city,
    },
    coordinates: { lat: parseFloat(best.lat), lng: parseFloat(best.lon) },
  };
}
