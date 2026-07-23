"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session;
}

function fields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const initials = String(formData.get("initials") ?? "").trim().toUpperCase().slice(0, 4);
  const role = String(formData.get("role") ?? "").trim();
  return { name, email, initials, role };
}

export async function createTeamMember(formData: FormData) {
  await requireSession();
  const { name, email, initials, role } = fields(formData);
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
      passwordHash: await bcrypt.hash(password, 10),
    },
  });
  revalidatePath("/team");
}

export async function updateTeamMember(formData: FormData) {
  await requireSession();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");
  const { name, email, initials, role } = fields(formData);
  if (!name || !email) throw new Error("Name and email are required");

  const clash = await prisma.user.findFirst({ where: { email, NOT: { id } } });
  if (clash) throw new Error("Another member already uses that email");

  await prisma.user.update({
    where: { id },
    data: { name, email, initials: initials || name.slice(0, 2).toUpperCase(), role: role || "Team Member" },
  });
  revalidatePath("/team");
}

// Set or reset a member's password.
export async function setMemberPassword(id: string, password: string) {
  await requireSession();
  if (!id) throw new Error("Missing id");
  if (password.length < 4) throw new Error("Password must be at least 4 characters");
  await prisma.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(password, 10) } });
  revalidatePath("/team");
}

export async function deleteTeamMember(id: string) {
  const session = await requireSession();
  if (session.user.id === id) throw new Error("You can't remove your own account");
  await prisma.user.delete({ where: { id } });
  revalidatePath("/team");
}
