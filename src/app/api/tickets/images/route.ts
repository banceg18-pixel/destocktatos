import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { ApiError, json, limitByIp, route } from "@/lib/server/api";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" };

/** Vérifie la signature binaire (le type MIME déclaré par le client n'est pas fiable). */
function sniff(buf: Buffer): string | null {
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 4).toString("ascii") === "GIF8") return "image/gif";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
}

/**
 * POST /api/tickets/images — captures d'écran des tickets (multipart, champs « images » ou « captureEcran »).
 * Fichiers stockés hors du dossier public (UPLOAD_DIR) : consultables uniquement par l'équipe.
 */
export const POST = route("POST /api/tickets/images", async (req: Request) => {
  limitByIp(req, "ticket-upload", 10);
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new ApiError(400, "Formulaire d'envoi invalide");
  }
  const files = [...form.getAll("images"), ...form.getAll("captureEcran")].filter((f): f is File => f instanceof File);
  if (files.length === 0) throw new ApiError(400, "Aucune image reçue");
  if (files.length > 3) throw new ApiError(400, "3 images maximum");
  const dir = path.resolve(process.env.UPLOAD_DIR || "./uploads", "tickets");
  await fs.mkdir(dir, { recursive: true });
  const saved: { url: string; name: string }[] = [];
  for (const f of files) {
    if (f.size > MAX_BYTES) throw new ApiError(413, "Le fichier est trop volumineux. Maximum 5MB autorisé.");
    const buf = Buffer.from(await f.arrayBuffer());
    const type = sniff(buf);
    if (!type || !ALLOWED[type]) throw new ApiError(415, "Format d'image non pris en charge (JPG, PNG, GIF, WEBP).");
    const name = `${crypto.randomUUID()}.${ALLOWED[type]}`;
    await fs.writeFile(path.join(dir, name), buf);
    saved.push({ url: `tickets/${name}`, name: f.name.slice(0, 120) });
  }
  return json({ images: saved, image: saved[0] }, 201);
});
