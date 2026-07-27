"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentProjectId } from "@/lib/project";
import { requireAccess } from "@/lib/authz";

// Financial line items power the per-project "Hard Cost Budget → Forecast"
// summary. Structure (add / rename / reorder / delete) is admin-only; editing a
// value is allowed for contributors. Viewers can do neither.

function num(raw: string): number | null {
  const s = raw.trim().replace(/[$,]/g, "");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function refresh() {
  revalidatePath("/hard-cost");
  revalidatePath("/dashboard");
  revalidatePath("/development");
}

// ---- Value edit (contributor) ----
export async function setLineItemValue(id: string, raw: string) {
  await requireAccess("contributor");
  await prisma.financialLineItem.update({ where: { id }, data: { value: num(raw) } });
  refresh();
}

// ---- Structure (admin only) ----
export async function addLineItem(formData: FormData) {
  await requireAccess("admin");
  const projectId = await getCurrentProjectId();
  if (!projectId) throw new Error("No project");
  const label = String(formData.get("label") ?? "").trim();
  if (!label) throw new Error("Label is required");
  const section = String(formData.get("section") ?? "").trim() || "Hard Cost Budget → Forecast";
  const emphasis = formData.get("emphasis") === "on" || formData.get("emphasis") === "true";
  const value = num(String(formData.get("value") ?? ""));

  const last = await prisma.financialLineItem.findFirst({ where: { projectId }, orderBy: { order: "desc" } });
  await prisma.financialLineItem.create({
    data: { projectId, label, section, emphasis, value, order: (last?.order ?? -1) + 1 },
  });
  refresh();
}

export async function updateLineItemMeta(formData: FormData) {
  await requireAccess("admin");
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");
  const label = String(formData.get("label") ?? "").trim();
  if (!label) throw new Error("Label is required");
  const section = String(formData.get("section") ?? "").trim() || "Hard Cost Budget → Forecast";
  const emphasis = formData.get("emphasis") === "on" || formData.get("emphasis") === "true";
  await prisma.financialLineItem.update({ where: { id }, data: { label, section, emphasis } });
  refresh();
}

export async function deleteLineItem(id: string) {
  await requireAccess("admin");
  await prisma.financialLineItem.delete({ where: { id } });
  refresh();
}

// Swap order with the adjacent item in the same section.
export async function moveLineItem(id: string, dir: "up" | "down") {
  await requireAccess("admin");
  const item = await prisma.financialLineItem.findUnique({ where: { id } });
  if (!item) throw new Error("Not found");
  const neighbor = await prisma.financialLineItem.findFirst({
    where: {
      projectId: item.projectId,
      section: item.section,
      order: dir === "up" ? { lt: item.order } : { gt: item.order },
    },
    orderBy: { order: dir === "up" ? "desc" : "asc" },
  });
  if (!neighbor) return; // already at the edge
  await prisma.$transaction([
    prisma.financialLineItem.update({ where: { id: item.id }, data: { order: neighbor.order } }),
    prisma.financialLineItem.update({ where: { id: neighbor.id }, data: { order: item.order } }),
  ]);
  refresh();
}
