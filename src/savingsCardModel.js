const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const cents = value => Math.round((value + Number.EPSILON) * 100) / 100;
export function savingsCardModel(saving, saved, allocation = {}) {
  const target = Math.max(0, number(saving.target));
  const rate = Math.max(0, Math.min(100, number(saving.allocationPct)));
  const profit = number(allocation.profit);
  const allocated = Math.max(0, number(allocation.target));
  return {
    saved:number(saved), target, rate, profit, allocated,
    retained:cents(Math.max(0, Math.max(0, profit) - allocated)),
    paid:Math.max(0, number(allocation.transferred)),
    ready:Math.max(0, number(allocation.remaining)),
    goalRemaining:Math.max(0, cents(target - number(saved))),
    progress:target > 0 ? Math.min(100, Math.max(0, number(saved) / target * 100)) : 0,
  };
}
