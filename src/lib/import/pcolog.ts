import ExcelJS from "exceljs";

export type PcoRow = {
  number: string | null;
  scope: string;
  status: string;
  value: number | null;
  oco: string | null;
  gcFunding: string | null;
  creFunding: string;
  contractorAllowance: number | null;
  buyout: number | null;
  contractorContingency: number | null;
  recoupableCosts: number | null;
  reason: string;
  notes: string | null;
};

// Map a variety of column header spellings to our fields.
function headerField(h: string): keyof PcoRow | null {
  const s = h.toLowerCase().replace(/[^a-z]/g, "");
  if (["pco", "pconumber", "number", "no"].includes(s)) return "number";
  if (["scope", "description", "descriptionofwork"].includes(s)) return "scope";
  if (["status", "pcostatus"].includes(s)) return "status";
  if (["value", "pcovalue", "pcovaluetocontract", "valuetocontract", "amount"].includes(s)) return "value";
  if (["oco", "oconumber"].includes(s)) return "oco";
  if (["gcfunding", "gcfundingby"].includes(s)) return "gcFunding";
  if (["crefunding", "crefundingsource", "funding", "fundingsource"].includes(s)) return "creFunding";
  if (["allowance", "contractorallowance"].includes(s)) return "contractorAllowance";
  if (["buyout"].includes(s)) return "buyout";
  if (["contingency", "contractorcontingency"].includes(s)) return "contractorContingency";
  if (["recoupable", "recoupablecosts"].includes(s)) return "recoupableCosts";
  if (["reason"].includes(s)) return "reason";
  if (["notes", "note"].includes(s)) return "notes";
  return null;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[$,()]/g, "").trim());
  return Number.isFinite(n) ? n : null;
}
function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s || null;
}

function rowFrom(map: Record<string, unknown>): PcoRow | null {
  const scope = str(map.scope);
  if (!scope) return null;
  return {
    number: str(map.number),
    scope,
    status: str(map.status) || "Pending",
    value: num(map.value),
    oco: str(map.oco),
    gcFunding: str(map.gcFunding),
    creFunding: str(map.creFunding) || "None/Other",
    contractorAllowance: num(map.contractorAllowance),
    buyout: num(map.buyout),
    contractorContingency: num(map.contractorContingency),
    recoupableCosts: num(map.recoupableCosts),
    reason: str(map.reason) || "Other",
    notes: str(map.notes),
  };
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

export function parsePcoCsv(text: string): PcoRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((h) => headerField(h));
  const rows: PcoRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const map: Record<string, unknown> = {};
    headers.forEach((f, j) => {
      if (f) map[f] = cells[j];
    });
    const r = rowFrom(map);
    if (r) rows.push(r);
  }
  return rows;
}

export async function parsePcoWorkbook(buffer: ArrayBuffer): Promise<PcoRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];

  // find the header row (the row where >=3 cells map to known fields)
  let headerRow = -1;
  let headers: (keyof PcoRow | null)[] = [];
  for (let r = 1; r <= Math.min(ws.rowCount, 40); r++) {
    const cells = ws.getRow(r).values as unknown[];
    const mapped = cells.map((c) => (typeof c === "string" ? headerField(c) : null));
    if (mapped.filter(Boolean).length >= 3) {
      headerRow = r;
      headers = mapped as (keyof PcoRow | null)[];
      break;
    }
  }
  if (headerRow < 0) return [];

  const rows: PcoRow[] = [];
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const cells = ws.getRow(r).values as unknown[];
    const map: Record<string, unknown> = {};
    headers.forEach((f, j) => {
      if (f) map[f] = cells[j];
    });
    const row = rowFrom(map);
    if (row) rows.push(row);
  }
  return rows;
}
