"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { requireAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { PROJECT_COOKIE } from "@/lib/project";

async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
}

export async function switchProject(projectId: string) {
  await requireSession();
  const store = await cookies();
  store.set(PROJECT_COOKIE, projectId, { path: "/", httpOnly: false, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/", "layout");
}

export async function createProject(formData: FormData) {
  await requireAccess("contributor");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Project name is required");

  const project = await prisma.project.create({
    data: {
      name,
      code: String(formData.get("code") ?? "").trim() || null,
      client: String(formData.get("client") ?? "").trim() || null,
      location: String(formData.get("location") ?? "").trim() || null,
      reportDate: new Date(),
      // Seed an empty financial snapshot so the hard-cost page has something to edit.
      financials: { create: { asOfDate: new Date() } },
      // Empty PCO summary row for the PCO page.
      pcoSummary: { create: {} },
    },
  });

  const store = await cookies();
  store.set(PROJECT_COOKIE, project.id, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/", "layout");
  redirect("/dashboard");
}
