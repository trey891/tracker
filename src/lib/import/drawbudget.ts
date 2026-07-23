import ExcelJS from "exceljs";

// Best-effort scan of a draw sheet / budget-detail export (Excel). We look for
// rows whose label matches a known financial figure and take the largest
// dollar value in that row. Every hit becomes a proposed change the user
// confirms, so a wrong guess is caught in the preview rather than applied.

export type FinHit = { field: string; label: string; value: number };

const TARGETS: { field: string; label: string; match: RegExp }[] = [
  { field: "originalBudget", label: "Original Budget", match: /original\s*budget/i },
  { field: "currentBudget", label: "Current Budget", match: /current\s*budget|revised\s*budget|total\s*budget/i },
  { field: "currentCommitments", label: "Current Commitments", match: /current\s*commitments|total\s*committed|committed/i },
  { field: "costsToDate", label: "Costs to Date", match: /costs?\s*(incurred\s*)?to\s*date|total\s*completed|completed\s*(&|and)\s*stored/i },
  { field: "uncommittedBudget", label: "Uncommitted Budget", match: /uncommitted/i },
  { field: "projectedFinalCost", label: "Projected Final Cost", match: /projected\s*final|estimated\s*(gc\s*)?complet/i },
  { field: "contingencyBalance", label: "Contingency Balance", match: /contingency\s*balance|contingency\s*remaining/i },
  { field: "retainage", label: "Retainage", match: /retainage/i },
];

function toNum(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (v === null || v === undefined) return null;
  const n = Number(String(v).replace(/[$,()]/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

export async function parseDrawBudget(buffer: ArrayBuffer): Promise<FinHit[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const hits: Record<string, FinHit> = {};

  for (const ws of wb.worksheets) {
    for (let r = 1; r <= ws.rowCount; r++) {
      const cells = (ws.getRow(r).values as unknown[]) ?? [];
      const label = cells.map((c) => (typeof c === "string" ? c : "")).join(" ").trim();
      if (!label) continue;
      const nums = cells.map(toNum).filter((n): n is number => n != null && Math.abs(n) >= 1000);
      if (nums.length === 0) continue;
      const value = nums.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a));
      for (const t of TARGETS) {
        if (t.match.test(label) && !hits[t.field]) {
          hits[t.field] = { field: t.field, label: t.label, value };
        }
      }
    }
  }
  return Object.values(hits);
}
