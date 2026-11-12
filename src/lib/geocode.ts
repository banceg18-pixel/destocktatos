/**
 * Geocoding von Adressen (Liefergebiet: Deutschland):
 * 1. Nominatim (OpenStreetMap), mehrere Formulierungen, auf Deutschland beschränkt;
 * 2. Nominatim ohne Länderbeschränkung als letzter Versuch.
 * Nutzbare im Browser (Anzeige der Optionen) und auf dem Server (maßgebliche Berechnung).
 * Die postalische Prüfung der Adresse übernimmt der Client (Vorschläge) bzw. der
 * Adress-Proxy `/api/addresses/suggestions` (nur noch für alte Bestellungen relevant).
 */

export interface LatLng {
  lat: number;
  lng: number;
}

async function geocodeNominatim(address: string, city: string, postalCode: string): Promise<LatLng | null> {
  const attempts = [
    `${address}, ${postalCode} ${city}, Deutschland`,
    `${address}, ${city}, ${postalCode}, Deutschland`,
    `${city}, ${postalCode}, Deutschland`,
    `${address}, ${city}, Deutschland`,
    `${postalCode}, Deutschland`,
  ];
  for (let i = 0; i < attempts.length; i++) {
    try {
      const q = encodeURIComponent(attempts[i]);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=3&countrycodes=de&addressdetails=1`,
        // Nominatim exige un User-Agent identifiant l'application (politique OSM).
        { headers: { "User-Agent": "Destocktatos/1.0 (https://destocktatos.com)", Accept: "application/json" } },
      );
      if (!res.ok) continue;
      const list = (await res.json()) as { lat: string; lon: string; display_name: string; address?: { postcode?: string } }[];
      if (list && list.length > 0) {
        const best = list.find((r) => r.address && (r.address.postcode === postalCode || r.display_name.includes(postalCode))) || list[0];
        return { lat: parseFloat(best.lat), lng: parseFloat(best.lon) };
      }
      if (i < attempts.length - 1) await new Promise((r) => setTimeout(r, 300));
    } catch {
      continue;
    }
  }
  // Letzter Versuch ohne Länderfilter (fachlich nicht nötig, aber schadet nicht).
  try {
    const q = encodeURIComponent(`${address}, ${postalCode} ${city}`);
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1`, {
      headers: { "User-Agent": "Destocktatos/1.0 (https://destocktatos.com)", Accept: "application/json" },
    });
    if (res.ok) {
      const list = (await res.json()) as { lat: string; lon: string }[];
      if (list && list.length > 0) return { lat: parseFloat(list[0].lat), lng: parseFloat(list[0].lon) };
    }
  } catch {
    /* Netzwerkproblem: unten null zurückgeben */
  }
  return null;
}

export async function geocodeAddress(address: string, city: string, postalCode: string): Promise<LatLng | null> {
  const a = address.trim();
  const c = city.trim();
  const p = postalCode.trim();
  if (!a || !c || !p) return null;
  return await geocodeNominatim(a, c, p);
}
