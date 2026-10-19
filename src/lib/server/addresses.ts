import "server-only";
import { prisma } from "@/lib/prisma";
import type { AddressInput } from "@/lib/validation";
import { ApiError } from "./api";

export const MAX_ADDRESSES = 10;

export function toAddressDTO(a: {
  id: string;
  fullName: string;
  address: string;
  city: string;
  postalCode: string;
  phone: string;
  additionalInfo: string;
  floor: number;
  isDefault: boolean;
}) {
  return {
    _id: a.id,
    fullName: a.fullName,
    address: a.address,
    city: a.city,
    postalCode: a.postalCode,
    phone: a.phone,
    additionalInfo: a.additionalInfo,
    floor: a.floor,
    isDefault: a.isDefault,
  };
}

export async function listAddresses(userId: string) {
  const rows = await prisma.address.findMany({ where: { userId }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] });
  return rows.map(toAddressDTO);
}

async function owned(userId: string, id: string) {
  const a = await prisma.address.findUnique({ where: { id } });
  // 404 aussi pour l'adresse d'un autre client : on ne révèle pas son existence.
  if (!a || a.userId !== userId) throw new ApiError(404, "Adresse introuvable");
  return a;
}

export async function getAddress(userId: string, id: string) {
  return toAddressDTO(await owned(userId, id));
}

export async function createAddress(userId: string, input: AddressInput) {
  return prisma.$transaction(async (tx) => {
    const count = await tx.address.count({ where: { userId } });
    if (count >= MAX_ADDRESSES) throw new ApiError(400, `Vous ne pouvez pas enregistrer plus de ${MAX_ADDRESSES} adresses`);
    const makeDefault = input.isDefault || count === 0;
    if (makeDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
    const a = await tx.address.create({ data: { ...input, isDefault: makeDefault, userId } });
    return toAddressDTO(a);
  });
}

export async function updateAddress(userId: string, id: string, input: AddressInput) {
  const current = await owned(userId, id);
  return prisma.$transaction(async (tx) => {
    const makeDefault = input.isDefault || current.isDefault;
    if (input.isDefault) await tx.address.updateMany({ where: { userId, id: { not: id } }, data: { isDefault: false } });
    const a = await tx.address.update({ where: { id }, data: { ...input, isDefault: makeDefault } });
    return toAddressDTO(a);
  });
}

export async function deleteAddress(userId: string, id: string) {
  const current = await owned(userId, id);
  await prisma.$transaction(async (tx) => {
    await tx.address.delete({ where: { id } });
    if (current.isDefault) {
      const next = await tx.address.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } });
      if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  });
}

export async function setDefaultAddress(userId: string, id: string) {
  await owned(userId, id);
  await prisma.$transaction([
    prisma.address.updateMany({ where: { userId }, data: { isDefault: false } }),
    prisma.address.update({ where: { id }, data: { isDefault: true } }),
  ]);
}
