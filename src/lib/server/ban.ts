import "server-only";

/** Client serveur de la Base Adresse Nationale (service public français, sans clé). */
const BAN = (process.env.ADDRESS_API_URL || "https://api-adresse.data.gouv.fr").replace(/\/$/, "");

interface BanFeature {
  geometry: { coordinates: [number, number] };
  properties: { id: string; label: string; name: string; postcode: string; city: string; score: number; type: string };
}

async function ban(path: string): Promise<BanFeature[]> {
  const res = await fetch(`${BAN}${path}`, { headers: { Accept: "application/json" }, next: { revalidate: 86400 } });
  if (!res.ok) throw new Error(`BAN HTTP ${res.status}`);
  const data = (await res.json()) as { features?: BanFeature[] };
  return data.features ?? [];
}

export async function suggestAddresses(q: string) {
  const features = await ban(`/search/?q=${encodeURIComponent(q)}&limit=5&autocomplete=1`);
  return features.map((f) => ({
    id: f.properties.id,
    label: f.properties.label,
    address: f.properties.name,
    postalCode: f.properties.postcode,
    city: f.properties.city,
  }));
}

/** Valide une adresse : correspondance suffisante dans la BAN pour ce code postal. */
export async function validateAddress(address: string, postalCode: string, city: string) {
  const features = await ban(`/search/?q=${encodeURIComponent(`${address} ${postalCode} ${city}`)}&limit=3&postcode=${encodeURIComponent(postalCode)}`);
  const best = features.find((f) => f.properties.score >= 0.4);
  if (!best) return { valid: false as const, error: "Adresse introuvable. Vérifiez l'adresse, le code postal et la ville." };
  return {
    valid: true as const,
    normalizedAddress: {
      address: best.properties.type === "municipality" ? address : best.properties.name,
      postalCode: best.properties.postcode,
      city: best.properties.city,
    },
    coordinates: { lat: best.geometry.coordinates[1], lng: best.geometry.coordinates[0] },
  };
}
