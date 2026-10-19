import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { invalidateCatalog } from "@/lib/catalog/repository";
import { ApiError, json, parseBody, requireUser, route } from "@/lib/server/api";
import { cancelPendingOrder } from "@/lib/server/orders";

/** GET /api/users/me — profil minimal de l'utilisateur connecté (jamais le hash du mot de passe). */
export const GET = route("GET /api/users/me", async () => {
  const session = await requireUser();
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true, name: true, email: true, image: true, role: true, createdAt: true, passwordHash: true },
  });
  if (!user) throw new ApiError(404, "Utilisateur introuvable");
  return json({ _id: user.id, name: user.name, email: user.email, image: user.image, role: user.role, createdAt: user.createdAt, hasPassword: !!user.passwordHash });
});

const profileSchema = z.object({ name: z.string().trim().min(2, "Indiquez votre nom (2 caractères au moins).").max(80, "Nom trop long (80 caractères au plus).") });

/** PATCH /api/users/me — modification du nom affiché (factures, emails, avis). */
export const PATCH = route("PATCH /api/users/me", async (req: Request) => {
  const session = await requireUser();
  const { name } = await parseBody(req, profileSchema);
  const user = await prisma.user.update({ where: { id: session.id }, data: { name }, select: { name: true } });
  return json({ name: user.name });
});

const deleteSchema = z.object({ confirm: z.literal("SUPPRIMER", { errorMap: () => ({ message: "Tapez SUPPRIMER pour confirmer." }) }) });

/**
 * DELETE /api/users/me — suppression du compte (RGPD). Les commandes et factures sont conservées
 * (obligation comptable) mais rendues anonymes ; adresses, avis et accès sont effacés.
 */
export const DELETE = route("DELETE /api/users/me", async (req: Request) => {
  const session = await requireUser();
  await parseBody(req, deleteSchema);
  const pending = await prisma.order.count({ where: { userId: session.id, status: { in: ["PAYEE", "EN_PREPARATION", "EXPEDIEE"] } } });
  if (pending) throw new ApiError(409, "Une commande est encore en cours : le compte pourra être supprimé une fois la livraison effectuée.");
  // Commandes non payées : annulées et leur stock réservé remis en vente.
  for (const o of await prisma.order.findMany({ where: { userId: session.id, status: "EN_ATTENTE_PAIEMENT" }, select: { id: true } })) {
    await cancelPendingOrder(session.id, o.id).catch(() => {});
  }
  await prisma.$transaction([
    prisma.address.deleteMany({ where: { userId: session.id } }),
    prisma.review.deleteMany({ where: { userId: session.id } }),
    prisma.passwordResetToken.deleteMany({ where: { userId: session.id } }),
    prisma.user.update({
      where: { id: session.id },
      data: { name: "Compte supprimé", email: `supprime-${session.id}@compte-supprime.invalid`, passwordHash: null, image: null },
    }),
  ]);
  invalidateCatalog(); // notes moyennes recalculées sans ses avis
  return json({ deleted: true });
});
