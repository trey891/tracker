/**
 * Seeds the database from prisma/seed-data.json (produced by
 * scripts/extract_xlsx.py). Idempotent: wipes existing rows for the seeded
 * project and re-creates them, and upserts team users.
 *
 *   npm run db:seed
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Json = Record<string, any>;

function d(v: string | null | undefined): Date | null {
  if (!v) return null;
  const dt = new Date(v);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

const ADMIN_EMAIL = "dewallette@gmail.com";

// Idempotently add data introduced after the initial deploy to an existing DB
// without disturbing anything the team has already entered.
async function backfill(data: Json) {
  // Access roles (added after first release): the designated admin.
  await prisma.user.updateMany({ where: { email: ADMIN_EMAIL }, data: { access: "admin" } });

  const project = await prisma.project.findFirst({ where: { name: data.project.name } });
  if (!project) return;

  // PCO line items (added after first release) — only if none exist yet.
  const pcoCount = await prisma.pco.count({ where: { projectId: project.id } });
  if (pcoCount === 0 && Array.isArray(data.pcos) && data.pcos.length) {
    await prisma.pco.createMany({
      data: (data.pcos as Json[]).map((p, i) => ({
        projectId: project.id,
        orderIndex: i,
        number: p.number ?? null,
        scope: p.scope,
        status: p.status ?? "Pending",
        value: p.value ?? null,
        oco: p.oco != null ? String(p.oco) : null,
        gcFunding: p.gcFunding ?? null,
        creFunding: p.creFunding ?? "None/Other",
        contractorAllowance: p.contractorAllowance ?? null,
        buyout: p.buyout ?? null,
        contractorContingency: p.contractorContingency ?? null,
        recoupableCosts: p.recoupableCosts ?? null,
        reason: p.reason ?? "Other",
        notes: p.notes ?? null,
      })),
    });
    console.log(`  backfilled ${(data.pcos as Json[]).length} PCO line items`);
  }

  await backfillLineItems();
}

// Default rows for the per-project "Hard Cost Budget → Forecast" summary,
// seeded from whatever the project's latest snapshot has so the page isn't
// blank. Admins then rename/reorder to match each project's real breakdown.
const LINE_ITEM_TEMPLATE: { field: string; label: string; emphasis?: boolean }[] = [
  { field: "originalBudget", label: "Original Budget (A)" },
  { field: "approvedChanges", label: "Approved Changes (B)" },
  { field: "currentBudget", label: "Current Budget (D)", emphasis: true },
  { field: "currentCommitments", label: "Current Commitments (H)" },
  { field: "uncommittedBudget", label: "Uncommitted Budget (I)" },
  { field: "costsToDate", label: "Costs to Date (J)" },
  { field: "unspentCommitments", label: "Unspent Commitments (K)" },
  { field: "pendingCosPcos", label: "Pending COs & PCOs (M)" },
  { field: "projectedFinalCost", label: "Projected Final Cost (P)", emphasis: true },
  { field: "overUnderBeforeContingency", label: "Over / (Under) before Contingency" },
  { field: "contingencyBalance", label: "HC Contingency Balance (R)" },
  { field: "contractorContingency", label: "Contractor Contingency (T)" },
];

// Idempotent: only seeds line items for projects that have none yet.
async function backfillLineItems() {
  const projects = await prisma.project.findMany({ select: { id: true } });
  for (const p of projects) {
    const count = await prisma.financialLineItem.count({ where: { projectId: p.id } });
    if (count > 0) continue;
    const fin = await prisma.financialSnapshot.findFirst({ where: { projectId: p.id }, orderBy: { asOfDate: "desc" } });
    const finRec = fin as Record<string, number | null> | null;
    await prisma.financialLineItem.createMany({
      data: LINE_ITEM_TEMPLATE.map((t, i) => ({
        projectId: p.id,
        section: "Hard Cost Budget → Forecast",
        label: t.label,
        value: finRec?.[t.field] ?? null,
        emphasis: !!t.emphasis,
        order: i,
      })),
    });
    console.log(`  backfilled ${LINE_ITEM_TEMPLATE.length} financial line items for project ${p.id}`);
  }
}

async function main() {
  const data: Json = JSON.parse(
    readFileSync(join(process.cwd(), "prisma", "seed-data.json"), "utf8"),
  );

  // Safe to run on every deploy: if the database already has a project we skip
  // the full seed (so in-app edits are never wiped), but still backfill any
  // brand-new data added in later releases (e.g. the PCO line-item log).
  // Set SEED_FORCE=1 to reseed everything regardless.
  if (!process.env.SEED_FORCE) {
    const existing = await prisma.project.count();
    if (existing > 0) {
      await backfill(data);
      console.log(`Database already has ${existing} project(s); ran backfills, skipped full seed (set SEED_FORCE=1 to override).`);
      return;
    }
  }

  const seedPassword = process.env.SEED_PASSWORD || "pulse-changeme-2026";
  const passwordHash = await bcrypt.hash(seedPassword, 10);

  // --- Team users (upsert by email) ---
  for (const m of data.team as Json[]) {
    const access = m.email.toLowerCase() === ADMIN_EMAIL ? "admin" : "contributor";
    await prisma.user.upsert({
      where: { email: m.email.toLowerCase() },
      update: { name: m.name, initials: m.initials, role: m.role, access },
      create: {
        email: m.email.toLowerCase(),
        name: m.name,
        initials: m.initials,
        role: m.role,
        access,
        passwordHash,
      },
    });
  }
  console.log(`✓ ${data.team.length} team users`);

  // --- Project (recreate by name so re-seeding is clean) ---
  const p = data.project as Json;
  await prisma.project.deleteMany({ where: { name: p.name } });
  const project = await prisma.project.create({
    data: {
      name: p.name,
      code: p.code,
      client: p.client,
      location: p.location,
      asOfDate: d(p.asOfDate),
      reportDate: d(p.reportDate),
      projectExec: p.team?.projectExec,
      construction: p.team?.construction,
      projectManagement: p.team?.projectManagement,
      coordinator: p.team?.coordinator,
      weatherContractDays: data.weather?.contractDays ?? null,
      weatherUsedThisPeriod: data.weather?.usedThisPeriod ?? null,
      weatherTotalUsed: data.weather?.totalUsed ?? null,
      weatherBalance: data.weather?.balance ?? null,
      submittalsSubmitted: data.submittals?.submittedToDate ?? null,
      submittalsReturned: data.submittals?.returnedOrVoided ?? null,
      submittalsOutstanding: data.submittals?.outstanding ?? null,
    },
  });
  const projectId = project.id;

  // --- Tasks ---
  await prisma.task.createMany({
    data: (data.tasks as Json[]).map((t) => ({
      projectId,
      title: t.title,
      workstream: t.workstream,
      status: t.status,
      priority: t.priority,
      lead: t.lead ?? null,
      deadline: d(t.deadline),
      note: t.note ?? null,
      blocker: t.blocker ?? null,
      topIssue: !!t.topIssue,
    })),
  });
  console.log(`✓ ${data.tasks.length} tasks`);

  // --- Financial snapshot ---
  const f = data.financials as Json;
  await prisma.financialSnapshot.create({
    data: {
      projectId,
      asOfDate: d(f.asOfDate) ?? new Date(),
      originalBudget: f.originalBudget,
      approvedChanges: f.approvedChanges,
      reallocationsFromTI: f.reallocationsFromTI,
      currentBudget: f.currentBudget,
      commitments: f.commitments,
      nonContractedInvoiced: f.nonContractedInvoiced,
      ffeAllowance: f.ffeAllowance,
      currentCommitments: f.currentCommitments,
      uncommittedBudget: f.uncommittedBudget,
      costsToDate: f.costsToDate,
      unspentCommitments: f.unspentCommitments,
      allowances: f.allowances,
      pendingCosPcos: f.pendingCosPcos,
      forecasted: f.forecasted,
      overUnderBeforeContingency: f.overUnderBeforeContingency,
      projectedFinalCost: f.projectedFinalCost,
      contingencyNeeded: f.contingencyNeeded,
      contingencyBalance: f.contingencyBalance,
      trendingContingencyAtCompletion: f.trendingContingencyAtCompletion,
      contractorContingency: f.contractorContingency,
      pcosApprovedPendingCo: f.pcosApprovedPendingCo,
      pcosApprovedPendingCoQty: f.pcosApprovedPendingCoQty,
      pcosPending: f.pcosPending,
      pcosPendingQty: f.pcosPendingQty,
      totalPcos: f.totalPcos,
      totalPcosQty: f.totalPcosQty,
      cosApproved: f.cosApproved,
      cosApprovedQty: f.cosApprovedQty,
      totalCos: f.totalCos,
      totalCosQty: f.totalCosQty,
      softCostBudget: f.softCostBudget,
      softCostCommitments: f.softCostCommitments,
      softCostContingency: f.softCostContingency,
      softCostUncommitted: f.softCostUncommitted,
      softCostContingencyBalance: f.softCostContingencyBalance,
      equityBudget: f.equityBudget,
      equityRequested: f.equityRequested,
      loanBudget: f.loanBudget,
      loanRequested: f.loanRequested,
    },
  });
  console.log("✓ financial snapshot");

  // --- PCO summary + breakdowns ---
  const ps = data.pcoSummary as Json;
  await prisma.pcoSummary.create({
    data: {
      projectId,
      totalPcos: ps.totalPcos,
      totalValue: ps.totalValue,
      originalContractSum: ps.originalContractSum,
      currentContract: ps.currentContract,
    },
  });
  await prisma.pcoStatusBucket.createMany({
    data: [
      { status: "Approved", count: ps.approvedCount, value: ps.approvedValue },
      { status: "Pending", count: ps.pendingCount, value: ps.pendingValue },
      { status: "ROM", count: ps.romCount, value: ps.romValue },
      { status: "Voided", count: ps.voidedCount, value: ps.voidedValue },
    ].map((b) => ({ projectId, ...b })),
  });
  await prisma.pcoReason.createMany({
    data: (data.pcoReasons as Json[]).map((r) => ({
      projectId,
      reason: r.reason,
      count: r.count,
      value: r.value,
      pctOfApproved: r.pctOfApproved,
    })),
  });
  await prisma.pcoFundingSource.createMany({
    data: (data.pcoFunding as Json[]).map((r) => ({
      projectId,
      source: r.source,
      count: r.count,
      value: r.value,
      pctOfFunded: r.pctOfFunded,
    })),
  });
  await prisma.allowance.createMany({
    data: (data.allowances as Json[]).map((a) => ({
      projectId,
      name: a.name,
      amount: a.amount,
      used: a.used,
      balance: a.balance,
      pcReference: a.pcReference ?? null,
    })),
  });
  await prisma.pco.createMany({
    data: (data.pcos as Json[]).map((p, i) => ({
      projectId,
      orderIndex: i,
      number: p.number ?? null,
      scope: p.scope,
      status: p.status ?? "Pending",
      value: p.value ?? null,
      oco: p.oco != null ? String(p.oco) : null,
      gcFunding: p.gcFunding ?? null,
      creFunding: p.creFunding ?? "None/Other",
      contractorAllowance: p.contractorAllowance ?? null,
      buyout: p.buyout ?? null,
      contractorContingency: p.contractorContingency ?? null,
      recoupableCosts: p.recoupableCosts ?? null,
      reason: p.reason ?? "Other",
      notes: p.notes ?? null,
    })),
  });
  console.log(`✓ PCO summary, ${data.allowances.length} allowances, ${(data.pcos as Json[]).length} PCO line items`);

  // --- Commitments ---
  await prisma.commitment.createMany({
    data: (data.commitments as Json[]).map((c) => ({
      projectId,
      vendor: c.vendor,
      contract: c.contract ?? null,
      startDate: d(c.startDate),
      endDate: d(c.endDate),
      status: c.status ?? "Approved",
      originalContract: c.originalContract,
      changeOrderAmount: c.changeOrderAmount,
      totalContract: c.totalContract,
      pendingCos: c.pendingCos,
      invoiced: c.invoiced,
      remaining: c.remaining,
    })),
  });
  console.log(`✓ ${data.commitments.length} commitments`);

  // --- Schedule ---
  await prisma.milestone.createMany({
    data: (data.milestones as Json[]).map((m) => ({
      projectId,
      seq: m.seq,
      description: m.description,
      baseDate: d(m.baseDate),
      contractDate: d(m.contractDate),
      currentDate: d(m.currentDate),
      varianceDays: m.varianceDays,
    })),
  });
  await prisma.designIssuance.createMany({
    data: (data.designIssuances as Json[]).map((x) => ({
      projectId,
      description: x.description,
      receivedDate: d(x.receivedDate),
    })),
  });
  await prisma.lookaheadItem.createMany({
    data: (data.lookahead as string[]).map((x) => ({ projectId, description: x })),
  });
  await prisma.weeklyStatus.createMany({
    data: (data.weeklyStatus as Json[]).map((w, i) => ({
      projectId,
      week: w.week,
      orderIndex: i,
      onTrack: w.onTrack,
      needsAttention: w.needsAttention,
      blocked: w.blocked,
      done: w.done,
    })),
  });
  console.log(
    `✓ ${data.milestones.length} milestones, ${data.designIssuances.length} design issuances, ` +
      `${data.lookahead.length} lookahead, ${data.weeklyStatus.length} weekly snapshots`,
  );

  await backfillLineItems();

  console.log(`\nDone. Project "${project.name}" seeded.`);
  console.log(`Team login password: "${seedPassword}"  (change after first login)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
