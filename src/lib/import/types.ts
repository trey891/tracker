// Shared shapes for the document importer. A parsed upload becomes a Proposal
// of individual Changes the user reviews and confirms before anything is
// written. The Proposal is persisted on an ImportBatch for audit/apply.

export type DocType = "payapp" | "pcolog" | "drawbudget";

export type ChangeTarget = "commitment" | "financials" | "pco";

export type Change = {
  key: string; // unique within a proposal
  target: ChangeTarget;
  op: "update" | "create";
  entityId?: string; // id of the row to update
  label: string; // human label, e.g. "Beck — Total Contract"
  field?: string; // db field for updates
  value?: unknown; // value to write on scalar update
  record?: Record<string, unknown>; // patch (pco update) or full row (create)
  currentDisplay: string;
  proposedDisplay: string;
  changed: boolean; // whether proposed differs from current
};

export type Proposal = {
  summary: string;
  changes: Change[];
  warnings: string[];
};
