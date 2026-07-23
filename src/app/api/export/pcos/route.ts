import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentProject } from "@/lib/project";

export const dynamic = "force-dynamic";

function csvCell(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  const project = await getCurrentProject();
  if (!project) return new Response("No project", { status: 404 });

  const pcos = await prisma.pco.findMany({ where: { projectId: project.id }, orderBy: { orderIndex: "asc" } });
  const headers = [
    "PCO #", "Scope", "Status", "Value", "OCO", "GC Funding", "CRE Funding",
    "Allowance", "Buyout", "Contingency", "Recoupable", "Reason", "Notes",
  ];
  const lines = [headers.join(",")];
  for (const p of pcos) {
    lines.push([
      p.number, p.scope, p.status, p.value, p.oco, p.gcFunding, p.creFunding,
      p.contractorAllowance, p.buyout, p.contractorContingency, p.recoupableCosts, p.reason, p.notes,
    ].map(csvCell).join(","));
  }
  const csv = lines.join("\n");
  const stamp = new Date().toISOString().slice(0, 10);
  const safe = project.name.replace(/[^a-z0-9]+/gi, "_");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safe}_PCOs_${stamp}.csv"`,
    },
  });
}
