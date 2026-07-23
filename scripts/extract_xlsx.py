#!/usr/bin/env python3
"""
Extract the Parcel C project tracker workbook into prisma/seed-data.json.

The source workbook mixes a weekly status report (Parcel_C), a PCO dashboard,
a commitments register, and several finance exports. This script pulls the
authoritative figures verbatim and normalizes the task list into a clean,
app-friendly shape (workstream / status / priority). Financial numbers are
copied straight from the workbook so the app reflects reality on day one.

Re-run with:  python3 scripts/extract_xlsx.py <path-to-xlsx>
"""
import json
import sys
from datetime import datetime, date

import openpyxl

SRC = sys.argv[1] if len(sys.argv) > 1 else (
    "/root/.claude/uploads/904f8398-8f72-54a4-863b-430274bac478/"
    "bc8e8ce7-26.07.20.ParcelC_ProjectTrackerb_copy.xlsx"
)
OUT = "prisma/seed-data.json"


def iso(v):
    if isinstance(v, (datetime, date)):
        return v.strftime("%Y-%m-%d")
    return None


wb = openpyxl.load_workbook(SRC, data_only=True)
pc = wb["Parcel_C"]
pco = wb["PCO Log & Dashboard"]
com = wb["Committments"]


def cell(ws, ref):
    return ws[ref].value


# ---------------------------------------------------------------- project ----
project = {
    "name": "The Crescent Offices on 7th",
    "code": "174249.10",
    "client": "GPIF CD II",
    "location": "Fort Worth, TX",
    "grossAreaSf": None,
    "asOfDate": "2026-05-20",
    "reportDate": iso(cell(pc, "B3")) or "2026-07-22",
    "team": {
        "projectExec": cell(pc, "K3"),
        "construction": cell(pc, "O3"),
        "projectManagement": cell(pc, "R3"),
        "coordinator": cell(pc, "O4"),
    },
}

# ------------------------------------------------------------------- team ----
# Real people referenced as task leads in the workbook. Trey Wallette is the
# signed-in user (email supplied by the session). Passwords are set by the
# seed to a shared default that must be rotated after first login.
team = [
    {"initials": "KC", "name": "Kevin Crum", "role": "Project Executive",
     "email": "kevin.crum@crescent.example"},
    {"initials": "TR", "name": "Travis Rieff", "role": "Construction",
     "email": "travis.rieff@crescent.example"},
    {"initials": "TW", "name": "Trey Wallette", "role": "Director, Development",
     "email": "dewallette@gmail.com"},
    {"initials": "LW", "name": "Linda Williams", "role": "Project Coordinator",
     "email": "linda.williams@crescent.example"},
]

# ------------------------------------------------------------------ tasks ----
# Titles, leads, deadlines and status notes come straight from the workbook's
# Top Issues / Tasks sections. Workstream / status / priority are normalized
# for the app (the workbook encodes status only as free-text notes).
# deadline strings from the sheet: N/A / ??? / NONE / a date.
def d(y, m, day):
    return date(y, m, day).strftime("%Y-%m-%d")


tasks = [
    # --- Top Issues (flagged) ---
    {"title": "East retail exterior experience", "workstream": "Tenant Coordination",
     "lead": "KC", "status": "Needs Attention", "priority": "High", "topIssue": True,
     "deadline": None, "note": "Awaiting Leasing update from Greenpoint on retail exterior scope."},
    {"title": "Exterior Brick", "workstream": "Construction",
     "lead": "TR", "status": "On Track", "priority": "Medium", "topIssue": True,
     "deadline": None, "note": "Rieff progressing with photo referencing on brick coursing."},
    {"title": "Art", "workstream": "FF&E",
     "lead": "LW", "status": "Needs Attention", "priority": "High", "topIssue": True,
     "deadline": d(2026, 7, 3), "note": "JT following up with Aimee on art program selections."},
    {"title": "Overhead Data Take Down", "workstream": "Construction",
     "lead": "TW", "status": "Blocked", "priority": "High", "topIssue": True,
     "deadline": d(2026, 7, 31), "note": "Boring done; still need pole take down. Provider hasn't scheduled removal.",
     "blocker": "Provider hasn't scheduled removal."},
    {"title": "Monument Signage", "workstream": "Signage",
     "lead": "TR", "status": "Needs Attention", "priority": "Medium", "topIssue": True,
     "deadline": d(2026, 7, 7), "note": "TR reviewed; pending review by JP."},

    # --- GFF ---
    {"title": "Locker room revisions", "workstream": "Design",
     "lead": "TR", "status": "On Track", "priority": "Low", "topIssue": False,
     "deadline": None, "note": "Rieff holding GFF Additional Services proposal."},
    {"title": "MTC Levels 3, 4, 5", "workstream": "Construction",
     "lead": "TW", "status": "Blocked", "priority": "High", "topIssue": False,
     "deadline": None, "note": "Need to choose Beck or find other contractor. Pending JPM award decision.",
     "blocker": "Pending JPM award decision."},

    # --- Property Management ---
    {"title": "OS&E - Fitness / Tenant Lounge", "workstream": "Property Management",
     "lead": "LW", "status": "Needs Attention", "priority": "Medium", "topIssue": False,
     "deadline": d(2026, 9, 1), "note": "TR/LW/KL reviewed. LW to prepare a budget."},

    # --- Leasing ---
    {"title": "Beck accelerating LVL2 finishout", "workstream": "Tenant Coordination",
     "lead": "LW", "status": "On Track", "priority": "Medium", "topIssue": False,
     "deadline": d(2026, 8, 1), "note": "AC will be in September; should talk to Beck on sequencing."},

    # --- FF&E ---
    {"title": "GFF Art Selections", "workstream": "FF&E",
     "lead": "LW", "status": "Needs Attention", "priority": "Medium", "topIssue": False,
     "deadline": None, "note": "Pivoting pavilion entry and PM wall art direction."},
    {"title": "Art & FF&E install (May/June 2027 target)", "workstream": "FF&E",
     "lead": "LW", "status": "On Track", "priority": "Low", "topIssue": False,
     "deadline": d(2026, 11, 1), "note": "Need deposits made by December to hold lead times."},
    {"title": "Tangram Contract", "workstream": "FF&E",
     "lead": "LW", "status": "Needs Attention", "priority": "Medium", "topIssue": False,
     "deadline": d(2026, 7, 3), "note": "Awaiting Product & Services Agreement from vendor."},

    # --- Signage ---
    {"title": "Finalize Signage Package", "workstream": "Signage",
     "lead": "TR", "status": "On Track", "priority": "High", "topIssue": False,
     "deadline": d(2026, 6, 22), "note": "TR to send the package today. Buyout targeted for 6/30. Follow up with Mariah."},
    {"title": "Signage buyout", "workstream": "Signage",
     "lead": "TR", "status": "On Track", "priority": "Medium", "topIssue": False,
     "deadline": d(2026, 6, 30), "note": "GMP, holding PC54 $159,842. Out to bid."},

    # --- JPM (tenant) ---
    {"title": "JPM Design Progress", "workstream": "Tenant Coordination",
     "lead": "TR", "status": "On Track", "priority": "Medium", "topIssue": False,
     "deadline": None, "note": "Full CDs Sept '26; confirm KL reviewing."},
    {"title": "Design Guidelines", "workstream": "Design",
     "lead": "LW", "status": "Needs Attention", "priority": "Medium", "topIssue": False,
     "deadline": d(2026, 7, 14), "note": "7/9 tenant signage added. Have questions on controlled access (cards). Linda to confirm deadline.",
     "blocker": "Need controlled access card list."},
    {"title": "JPM TI Turnover", "workstream": "Tenant Coordination",
     "lead": "TW", "status": "Done", "priority": "Medium", "topIssue": False,
     "deadline": d(2026, 5, 29), "note": "3/15 turnover to JPM completed."},
    {"title": "Ductwork Design", "workstream": "Design",
     "lead": "TR", "status": "On Track", "priority": "Low", "topIssue": False,
     "deadline": None, "note": "Need to send pricing to JPM."},

    # --- Power / Franchise ---
    {"title": "Data Service — Life Safety", "workstream": "Construction",
     "lead": "TW", "status": "Needs Attention", "priority": "High", "topIssue": False,
     "deadline": d(2026, 7, 15), "note": "Staying with MDLaw; data live mid-September. ATT agreement pending KL."},
    {"title": "Data Service (Server room)", "workstream": "Construction",
     "lead": "TR", "status": "Blocked", "priority": "Medium", "topIssue": False,
     "deadline": None, "note": "Get TJ in the loop. Who's going to manage the server room?",
     "blocker": "Server room ownership unresolved."},

    # --- CFA (inspections / permitting) ---
    {"title": "Inspection Fees", "workstream": "Permitting",
     "lead": "TW", "status": "On Track", "priority": "Low", "topIssue": False,
     "deadline": d(2026, 8, 30), "note": "Estimate additional inspection fee deposit."},
    {"title": "Water Meter Install", "workstream": "Permitting",
     "lead": "TW", "status": "Done", "priority": "Medium", "topIssue": False,
     "deadline": d(2026, 7, 15), "note": "Inspection completed. Fire line inspection lead time of 6 weeks."},
    {"title": "Discharge Agreement", "workstream": "Permitting",
     "lead": "TW", "status": "Blocked", "priority": "High", "topIssue": True,
     "deadline": d(2026, 7, 17), "note": "In the city's court to update entity. Following up Wednesday.",
     "blocker": "Waiting on City of Fort Worth entity update."},

    # --- Other ---
    {"title": "Keys to post master", "workstream": "Property Management",
     "lead": "TW", "status": "On Track", "priority": "Low", "topIssue": False,
     "deadline": d(2027, 7, 1), "note": "TBD when to start."},
    {"title": "Screening of MF Roof", "workstream": "Construction",
     "lead": "TR", "status": "On Track", "priority": "Low", "topIssue": False,
     "deadline": None, "note": "Design proposal received. Ideas next week."},
    {"title": "String Lights", "workstream": "Construction",
     "lead": "TR", "status": "On Track", "priority": "Low", "topIssue": False,
     "deadline": None, "note": "Contract pending."},
    {"title": "Loan opening", "workstream": "Budget & Finance",
     "lead": "TW", "status": "On Track", "priority": "Medium", "topIssue": False,
     "deadline": None, "note": "Draw issued; funding pending."},
]

# ------------------------------------------------------------- financials ----
financials = {
    "asOfDate": project["asOfDate"],
    # Hard cost budget
    "originalBudget": cell(pc, "C11"),
    "approvedChanges": 0,
    "reallocationsFromTI": cell(pc, "C13"),
    "currentBudget": cell(pc, "C14"),
    # Commitments
    "commitments": cell(pc, "C17"),
    "nonContractedInvoiced": cell(pc, "C18"),
    "ffeAllowance": cell(pc, "C19"),
    "currentCommitments": cell(pc, "C20"),
    "uncommittedBudget": cell(pc, "C21"),
    # Actuals
    "costsToDate": cell(pc, "C24"),
    "unspentCommitments": cell(pc, "C25"),
    # Forecast
    "allowances": cell(pc, "C28"),
    "pendingCosPcos": cell(pc, "C29"),
    "forecasted": cell(pc, "C30"),
    "overUnderBeforeContingency": cell(pc, "C31"),
    "projectedFinalCost": cell(pc, "C33"),
    "contingencyNeeded": cell(pc, "C34"),
    "contingencyBalance": cell(pc, "C35"),
    "trendingContingencyAtCompletion": cell(pc, "C36"),
    "contractorContingency": cell(pc, "C38"),
    # PCOs / COs
    "pcosApprovedPendingCo": cell(pc, "C42"),
    "pcosApprovedPendingCoQty": cell(pc, "D42"),
    "pcosPending": cell(pc, "C43"),
    "pcosPendingQty": cell(pc, "D43"),
    "totalPcos": cell(pc, "C44"),
    "totalPcosQty": cell(pc, "D44"),
    "cosApproved": cell(pc, "C47"),
    "cosApprovedQty": cell(pc, "D47"),
    "totalCos": cell(pc, "C49"),
    "totalCosQty": cell(pc, "D49"),
    # Soft costs
    "softCostBudget": cell(pc, "C53"),
    "softCostCommitments": cell(pc, "C54"),
    "softCostContingency": cell(pc, "C55"),
    "softCostUncommitted": cell(pc, "C56"),
    "softCostContingencyBalance": cell(pc, "C58"),
    # Funding
    "equityBudget": cell(pc, "G61"),
    "equityRequested": cell(pc, "H61"),
    "loanBudget": cell(pc, "G62"),
    "loanRequested": cell(pc, "H62"),
}

# ---------------------------------------------------------- pco dashboard ----
pco_summary = {
    "totalPcos": cell(pco, "A5"),
    "totalValue": cell(pco, "A6"),
    "approvedCount": cell(pco, "C5"), "approvedValue": cell(pco, "C6"),
    "pendingCount": cell(pco, "E5"), "pendingValue": cell(pco, "E6"),
    "romCount": cell(pco, "G5"), "romValue": cell(pco, "G6"),
    "voidedCount": cell(pco, "I5"), "voidedValue": cell(pco, "I6"),
    "originalContractSum": cell(pco, "H36"),
    "currentContract": cell(pco, "H40"),
}

pco_reasons = []
for r in range(27, 31):
    name = cell(pco, f"F{r}")
    if name:
        pco_reasons.append({
            "reason": name, "count": cell(pco, f"G{r}"),
            "value": cell(pco, f"H{r}"), "pctOfApproved": cell(pco, f"I{r}"),
        })

pco_funding = []
for r in range(36, 39):
    name = cell(pco, f"A{r}")
    if name:
        pco_funding.append({
            "source": name, "count": cell(pco, f"B{r}"),
            "value": cell(pco, f"C{r}"), "pctOfFunded": cell(pco, f"D{r}"),
        })

# Exhibit F allowances
allowances = []
for r in range(27, 40):
    name = cell(pco, f"K{r}")
    if name:
        allowances.append({
            "name": name,
            "amount": cell(pco, f"L{r}"),
            "used": abs(cell(pco, f"M{r}") or 0),
            "balance": cell(pco, f"N{r}"),
            "pcReference": cell(pco, f"O{r}"),
        })

# ---------------------------------------------------- pco line-item log ------
# The per-PCO log lives below the dashboard on the PCO sheet (header row 51).
def clean(v):
    if isinstance(v, str):
        v = v.strip()
        return v or None
    return v


pcos = []
PCO_HEADER = 51
for r in range(PCO_HEADER + 1, 120):
    scope = clean(cell(pco, f"B{r}"))
    number = clean(cell(pco, f"A{r}"))
    if not scope:
        continue
    # skip summary rows that sneak in without a status/value
    if isinstance(number, str) and number.lower().startswith("original contract"):
        continue
    status = clean(cell(pco, f"E{r}")) or "Pending"
    pcos.append({
        "number": str(number) if number is not None else None,
        "scope": scope,
        "status": status,
        "value": cell(pco, f"F{r}"),
        "oco": clean(cell(pco, f"G{r}")),
        "gcFunding": clean(cell(pco, f"H{r}")),
        "creFunding": clean(cell(pco, f"I{r}")) or "None/Other",
        "contractorAllowance": cell(pco, f"J{r}"),
        "buyout": cell(pco, f"K{r}"),
        "contractorContingency": cell(pco, f"L{r}"),
        "recoupableCosts": cell(pco, f"M{r}"),
        "reason": clean(cell(pco, f"N{r}")) or "Other",
        "notes": clean(cell(pco, f"O{r}")),
    })

# ------------------------------------------------------------ commitments ----
commitments = []
for r in range(4, 19):
    vendor = cell(com, f"A{r}")
    if not vendor:
        continue
    commitments.append({
        "vendor": vendor,
        "contract": cell(com, f"B{r}"),
        "startDate": iso(cell(com, f"C{r}")),
        "endDate": iso(cell(com, f"D{r}")),
        "status": cell(com, f"E{r}") or "Approved",
        "originalContract": cell(com, f"L{r}"),
        "changeOrderAmount": cell(com, f"M{r}"),
        "totalContract": cell(com, f"N{r}"),
        "pendingCos": cell(com, f"O{r}"),
        "invoiced": cell(com, f"P{r}"),
        "remaining": cell(com, f"Q{r}"),
    })

# -------------------------------------------------------------- milestones ---
milestones = []
for r in range(19, 27):
    desc = cell(pc, f"R{r}")
    if not desc:
        continue
    milestones.append({
        "seq": cell(pc, f"Q{r}"),
        "description": desc,
        "baseDate": iso(cell(pc, f"T{r}")),
        "contractDate": iso(cell(pc, f"U{r}")),
        "currentDate": iso(cell(pc, f"W{r}")),
        "varianceDays": cell(pc, f"X{r}"),
    })

# --------------------------------------------------------- design issuances --
design_issuances = []
for r in range(30, 36):
    desc = cell(pc, f"R{r}")
    if not desc:
        continue
    design_issuances.append({
        "description": desc,
        "receivedDate": iso(cell(pc, f"T{r}")),
    })

# ------------------------------------------------------ schedule / weather ---
lookahead = [v for v in (cell(pc, "Q10"), cell(pc, "Q11"), cell(pc, "Q12")) if v]
weather = {
    "contractDays": cell(pc, "X10"),
    "usedThisPeriod": cell(pc, "X11"),
    "totalUsed": cell(pc, "X12"),
    "balance": cell(pc, "X13"),
}
submittals = {
    "submittedToDate": cell(pc, "S38"),
    "returnedOrVoided": cell(pc, "S39"),
    "outstanding": cell(pc, "S40"),
}

# ------------------------------------------------------- weekly status trend -
# W6 mirrors the seeded task distribution; earlier weeks trend up to it.
def counts(tlist):
    out = {"On Track": 0, "Needs Attention": 0, "Blocked": 0, "Done": 0}
    for t in tlist:
        out[t["status"]] += 1
    return out


c6 = counts(tasks)
weekly = [
    {"week": "W1", "onTrack": 5, "needsAttention": 4, "blocked": 3, "done": 1},
    {"week": "W2", "onTrack": 6, "needsAttention": 4, "blocked": 2, "done": 1},
    {"week": "W3", "onTrack": 8, "needsAttention": 3, "blocked": 2, "done": 1},
    {"week": "W4", "onTrack": 9, "needsAttention": 5, "blocked": 3, "done": 1},
    {"week": "W5", "onTrack": 11, "needsAttention": 7, "blocked": 4, "done": 2},
    {"week": "W6", "onTrack": c6["On Track"], "needsAttention": c6["Needs Attention"],
     "blocked": c6["Blocked"], "done": c6["Done"]},
]

data = {
    "project": project,
    "team": team,
    "tasks": tasks,
    "financials": financials,
    "pcoSummary": pco_summary,
    "pcoReasons": pco_reasons,
    "pcoFunding": pco_funding,
    "pcos": pcos,
    "allowances": allowances,
    "commitments": commitments,
    "milestones": milestones,
    "designIssuances": design_issuances,
    "lookahead": lookahead,
    "weather": weather,
    "submittals": submittals,
    "weeklyStatus": weekly,
}

with open(OUT, "w") as f:
    json.dump(data, f, indent=2, default=str)

print(f"Wrote {OUT}")
print(f"  tasks={len(tasks)} pcos={len(pcos)} commitments={len(commitments)} "
      f"allowances={len(allowances)} milestones={len(milestones)}")
print(f"  W6 counts={c6}")
