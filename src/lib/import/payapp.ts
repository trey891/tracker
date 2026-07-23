// Parse an AIA G702 "Application and Certificate for Payment".
//
// PDF text layers scramble the label→value pairing, so instead of relying on
// position we identify the nine summary figures by the G702's exact arithmetic
// relationships (which hold on every valid form):
//   contractSumToDate   = original + netChange
//   earnedLessRetainage = completed - retainage
//   currentPayment      = earnedLessRetainage - lessPrevious
//   balanceToFinish     = contractSumToDate - earnedLessRetainage
// This makes extraction independent of layout / column order.

export type G702 = {
  original: number;
  netChange: number;
  contractSumToDate: number;
  completed: number;
  retainage: number;
  earnedLessRetainage: number;
  lessPrevious: number;
  currentPayment: number;
  balanceToFinish: number;
  applicationNo?: string;
  periodTo?: string;
};

function currencies(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/[\d,]+\.\d{2}/g)) {
    const n = Number(m[0].replace(/,/g, ""));
    if (Number.isFinite(n) && n >= 1000) out.push(n);
  }
  return out;
}

const has = (arr: number[], x: number, tol = 1) => arr.some((n) => Math.abs(n - x) < tol);

export function parseG702(text: string): G702 | null {
  if (!/APPLICATION AND CERTIFICATE FOR PAYMENT|CONTRACT SUM TO DATE|ORIGINAL CONTRACT SUM/i.test(text)) {
    return null;
  }
  const u = [...new Set(currencies(text))];
  let best: G702 | null = null;

  for (const csd of u) {
    for (const original of u) {
      const netChange = +(csd - original).toFixed(2);
      if (!(original > csd * 0.5 && netChange > 0 && has(u, netChange))) continue;
      for (const completed of u) {
        if (completed >= csd) continue;
        for (const retainage of u) {
          const earned = +(completed - retainage).toFixed(2);
          if (!(retainage > 0 && retainage < completed * 0.25 && earned > completed * 0.6 && has(u, earned))) continue;
          for (const lessPrevious of u) {
            const currentPayment = +(earned - lessPrevious).toFixed(2);
            if (!(lessPrevious > 0 && currentPayment > 0 && has(u, currentPayment))) continue;
            const balanceToFinish = +(csd - earned).toFixed(2);
            if (!has(u, balanceToFinish)) continue;
            if (!best || csd > best.contractSumToDate) {
              best = {
                original,
                netChange,
                contractSumToDate: csd,
                completed,
                retainage,
                earnedLessRetainage: earned,
                lessPrevious,
                currentPayment,
                balanceToFinish,
              };
            }
          }
        }
      }
    }
  }

  if (!best) return null;

  const appNo = text.match(/APPLICATION NO\.?\s*:?\s*(\d+)/i);
  if (appNo) best.applicationNo = appNo[1];
  const period = text.match(/PERIOD TO\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
  if (period) best.periodTo = period[1];

  return best;
}
