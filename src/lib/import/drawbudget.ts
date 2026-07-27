import ExcelJS from "exceljs";

// Parses the accounting budget exports used to update the hard-cost financials.
// Two column layouts are supported; both share the same category rows, so the
// numbers are located by ROW LABEL (in column 2) and read with a per-format
// column map:
//
//  - Draw Sheet ("Draw Sheet ...", cols: Original / Revisions / Revised /
//    Prior / This / Total request / % / Remaining / This Retn / Total Retn).
//  - Job Cost Report Detail ("JobCostReportDetail...", cols: Approved Budget /
//    Revised Budget / Contracts CO's / ... / Total Committed / Uncommitted /
//    Current Period / Pending / Total Cost To Date / ...).
//
// Mapped rows: "Total Hard Cost(s)" / "Total Construction Hard Costs" → the
// hard-cost budget; "Total Soft Costs" → soft-cost budget; "Hard Cost
// Contingency" → contingency balance; the "GC/Construction" line → the GC
// commitment.

export type FinHit = { field: string; label: string; value: number };
export type GcLine = {
  original: number | null;
  changeOrder: number | null;
  total: number | null;
  invoiced: number | null;
  remaining: number | null;
  retainage: number | null;
};
export type DrawBudgetResult = { format: "draw" | "jobdetail" | "unknown"; financials: FinHit[]; gc: GcLine | null };

// Column positions (1-based) for a given report layout.
type ColMap = {
  original: number; // approved / original budget
  changeOrder?: number; // revisions / contracts CO's
  current: number; // revised budget
  costs: number; // total drawn / total cost to date
  remaining?: number; // remaining balance / uncommitted balance
  retainage?: number; // total retention (draw sheet only)
};

function toNum(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (v && typeof v === "object" && "result" in (v as object)) return toNum((v as { result: unknown }).result);
  if (v == null) return null;
  const n = Number(String(v).replace(/[$,()]/g, "").trim());
  return Number.isFinite(n) ? n : null;
}
const labelOf = (ws: ExcelJS.Worksheet, r: number, col: number) => String(ws.getRow(r).getCell(col).value ?? "").trim();

export async function parseDrawBudget(buffer: ArrayBuffer): Promise<DrawBudgetResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) return { format: "unknown", financials: [], gc: null };

  const a1 = String(ws.getRow(1).getCell(1).value ?? "");
  // Scan the header band (first ~12 rows) so detection works regardless of a1.
  let allHead = "";
  for (let r = 1; r <= Math.min(ws.rowCount, 12); r++)
    for (let c = 1; c <= Math.min(ws.columnCount, 30); c++) allHead += " " + String(ws.getRow(r).getCell(c).value ?? "");

  // Draw Sheet layout.
  const DRAW: ColMap = { original: 3, changeOrder: 4, current: 5, costs: 8, remaining: 10, retainage: 12 };
  // Job Cost Report Detail layout.
  const JOBCOST: ColMap = { original: 3, changeOrder: 5, current: 4, costs: 12, remaining: 9 };

  if (/draw sheet/i.test(a1) || (/retention/i.test(allHead) && /request/i.test(allHead))) return extract(ws, DRAW, "draw");
  if (/job\s*cost\s*report|jobcostreport/i.test(a1) || (/approved budget/i.test(allHead) && /total cost to date/i.test(allHead)))
    return extract(ws, JOBCOST, "jobdetail");
  // Legacy Job Detail Report (Revbudget columns, 200-series subtotal).
  if (/^Job:/i.test(a1) || /Revbudget/i.test(allHead)) return parseJobDetail(ws);
  return { format: "unknown", financials: [], gc: null };
}

// Label-driven extraction shared by both current layouts.
function extract(ws: ExcelJS.Worksheet, C: ColMap, format: "draw" | "jobdetail"): DrawBudgetResult {
  const financials: FinHit[] = [];
  let gc: GcLine | null = null;
  let softCurrent: number | null = null;

  for (let r = 1; r <= ws.rowCount; r++) {
    const label = labelOf(ws, r, 2).toLowerCase();
    if (!label) continue;
    const get = (col?: number) => (col ? toNum(ws.getRow(r).getCell(col).value) : null);

    // Contingency must be checked before the hard-cost subtotal so that
    // "Total Hard Cost Contingency" isn't mistaken for the hard-cost budget.
    if (label.includes("hard cost contingency")) {
      const v = get(C.current);
      if (v != null) financials.push({ field: "contingencyBalance", label: "Contingency Balance", value: v });
    } else if (label.startsWith("total hard cost") || label.includes("total construction hard cost")) {
      const push = (field: string, lbl: string, col?: number) => {
        const v = get(col);
        if (v != null) financials.push({ field, label: lbl, value: v });
      };
      push("originalBudget", "Original Budget", C.original);
      push("currentBudget", "Current Budget", C.current);
      push("costsToDate", "Costs to Date", C.costs);
      if (C.retainage) push("retainage", "Retainage", C.retainage);
    } else if (label.startsWith("total soft cost")) {
      softCurrent = get(C.current);
    } else if (/gc\/construction|gc construction/.test(label) && !label.startsWith("total")) {
      gc = {
        original: get(C.original),
        changeOrder: get(C.changeOrder),
        total: get(C.current),
        invoiced: get(C.costs),
        remaining: get(C.remaining),
        retainage: get(C.retainage),
      };
    }
  }

  if (softCurrent != null) financials.push({ field: "softCostBudget", label: "Soft Cost Budget", value: softCurrent });
  return { format, financials, gc };
}

// Legacy Job Detail Report (older export): Budget / Revision / Revbudget /
// Commitments / Invoiced / Cost to Complete, with a 200-series subtotal.
function parseJobDetail(ws: ExcelJS.Worksheet): DrawBudgetResult {
  const C = { budget: 4, revision: 5, revbudget: 6, commit: 9, invoiced: 15, costToComplete: 22 };
  const financials: FinHit[] = [];
  let gc: GcLine | null = null;
  let sumRevbudget = 0;
  let sumInvoiced = 0;
  let has200 = false;

  for (let r = 1; r <= ws.rowCount; r++) {
    const code = labelOf(ws, r, 1);
    const b = labelOf(ws, r, 2).toLowerCase();
    const get = (col: number) => toNum(ws.getRow(r).getCell(col).value);

    if (/^200[-\s]?0?10/.test(code) || (/gc\/construction|gc construction/.test(b) && !b.startsWith("total"))) {
      gc = {
        original: get(C.budget),
        changeOrder: get(C.revision),
        total: get(C.revbudget),
        invoiced: get(C.invoiced),
        remaining: get(C.costToComplete),
        retainage: null,
      };
    }
    if (/^200[-\s]/.test(code)) {
      has200 = true;
      sumRevbudget += get(C.revbudget) ?? 0;
      sumInvoiced += get(C.invoiced) ?? 0;
    }
  }
  if (has200) {
    if (sumRevbudget) financials.push({ field: "currentBudget", label: "Current Budget (200-series)", value: +sumRevbudget.toFixed(2) });
    if (sumInvoiced) financials.push({ field: "costsToDate", label: "Costs to Date (200-series)", value: +sumInvoiced.toFixed(2) });
  }
  return { format: "jobdetail", financials, gc };
}
