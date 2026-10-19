/**
 * Géocodage d'adresses françaises (même stratégie que le site source) :
 * 1. Base Adresse Nationale (api-adresse.data.gouv.fr, service public) ;
 * 2. repli sur Nominatim (OpenStreetMap) avec plusieurs formulations.
 * Utilisable côté navigateur (affichage des options) et côté serveur (calcul faisant foi).
 */

export interface LatLng {
  lat: number;
  lng: number;
}

const BAN_URL = (process.env.ADDRESS_API_URL || "https://api-adresse.data.gouv.fr").replace(/\/$/, "");

async function geocodeBan(address: string, city: string, postalCode: string): Promise<LatLng | null> {
  try {
    const q = encodeURIComponent(`${address} ${postalCode} ${city}`);
    const res = await fetch(`${BAN_URL}/search/?q=${q}&limit=3&autocomplete=0`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as {
      features?: { geometry: { coordinates: [number, number] }; properties: { postcode?: string; city?: string } }[];
    };
    if (data.features && data.features.length > 0) {
      const best =
        data.features.find(
          (f) => f.properties.postcode === postalCode && f.properties.city?.toLowerCase().includes(city.toLowerCase()),
        ) || data.features[0];
      return { lat: best.geometry.coordinates[1], lng: best.geometry.coordinates[0] };
    }
  } catch (e) {
    console.warn("Géocodage BAN indisponible:", e);
  }
  return null;
}

async function geocodeNominatim(address: string, city: string, postalCode: string): Promise<LatLng | null> {
  const attempts = [
    `${address}, ${postalCode} ${city}, France`,
    `${address}, ${city}, ${postalCode}, France`,
    `${city}, ${postalCode}, France`,
    `${address}, ${city}, France`,
    `${postalCode}, France`,
  ];
  for (let i = 0; i < attempts.length; i++) {
    try {
      const q = encodeURIComponent(attempts[i]);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=3&countrycodes=fr&addressdetails=1`,
        { headers: { Accept: "application/json" } },
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
  return null;
}

export async function geocodeAddress(address: string, city: string, postalCode: string): Promise<LatLng | null> {
  const a = address.trim();
  const c = city.trim();
  const p = postalCode.trim();
  if (!a || !c || !p) return null;
  return (await geocodeBan(a, c, p)) ?? (await geocodeNominatim(a, c, p));
}
