"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getAccess, requireAccess } from "@/lib/authz";

// Access rules:
//  - Only the admin can add members, remove members, set passwords, and edit
//    other members (including their access class).
//  - Contributors may edit their OWN name / email / initials / role.
//  - Viewers can change nothing.
// The designated admin account keeps "admin" access permanently; no one else
// can be promoted to admin.

function fields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const initials = String(formData.get("initials") ?? "").trim().toUpperCase().slice(0, 4);
  const role = String(formData.get("role") ?? "").trim();
  const accessRaw = String(formData.get("access") ?? "").trim();
  const access = accessRaw === "viewer" ? "viewer" : accessRaw === "contributor" ? "contributor" : null;
  return { name, email, initials, role, access };
}

export async function createTeamMember(formData: FormData) {
  await requireAccess("admin");
  const { name, email, initials, role, access } = fields(formData);
  const password = String(formData.get("password") ?? "");
  if (!name || !email) throw new Error("Name and email are required");
  if (password.length < 4) throw new Error("Password must be at least 4 characters");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("A member with that email already exists");

  await prisma.user.create({
    data: {
      name,
      email,
      initials: initials || name.slice(0, 2).toUpperCase(),
      role: role || "Team Member",
      access: access ?? "contributor",
      passwordHash: await bcrypt.hash(password, 10),
    },
  });
  revalidatePath("/team");
}

export async function updateTeamMember(formData: FormData) {
  const { session, access: myAccess } = await getAccess();
  if (!session?.user) throw new Error("Unauthorized");

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");
  const { name, email, initials, role, access } = fields(formData);
  if (!name || !email) throw new Error("Name and email are required");

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw new Error("Member not found");

  const isSelf = session.user.id === id;
  if (myAccess !== "admin" && !(isSelf && myAccess === "contributor")) {
    throw new Error(isSelf ? "Your account is view-only." : "Only the admin can edit other members.");
  }

  const clash = await prisma.user.findFirst({ where: { email, NOT: { id } } });
  if (clash) throw new Error("Another member already uses that email");

  const data: Record<string, string> = {
    name,
    email,
    initials: initials || name.slice(0, 2).toUpperCase(),
    role: role || "Team Member",
  };
  // Only the admin assigns access classes, never to/from the admin account.
  if (myAccess === "admin" && access && target.access !== "admin") data.access = access;

  await prisma.user.update({ where: { id }, data });
  revalidatePath("/team");
}

// Set or reset a member's password — admin only.
export async function setMemberPassword(id: string, password: string) {
  await requireAccess("admin");
  if (!id) throw new Error("Missing id");
  if (password.length < 4) throw new Error("Password must be at least 4 characters");
  await prisma.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(password, 10) } });
  revalidatePath("/team");
}

export async function deleteTeamMember(id: string) {
  const session = await requireAccess("admin");
  if (session.user.id === id) throw new Error("You can't remove your own account");
  const target = await prisma.user.findUnique({ where: { id }, select: { access: true } });
  if (target?.access === "admin") throw new Error("The admin account can't be removed");
  await prisma.user.delete({ where: { id } });
  revalidatePath("/team");
}
