import { useEffect, useRef, useState } from 'react';

// Live challenge funding check for the Add funds form. `p.onCheckDeposit` returns
// { allowed:true } or { allowed:false, reason, maximum, maxLevel, totalLevels, fundedLevel }.
// The same check runs again when the deposit is saved, so this is guidance only.
export function useDepositCheck(p, active = true) {
  const [block, setBlock] = useState(null);
  const checkRef = useRef(p.onCheckDeposit);
  checkRef.current = p.onCheckDeposit;
  useEffect(() => {
    const typed = Number(p.amount);
    if (!active || p.type !== 'deposit' || !checkRef.current) { setBlock(null); return undefined; }
    let live = true;
    const timer = setTimeout(async () => {
      try {
        const result = await checkRef.current({ type: 'deposit', balanceId: p.balanceId || null, amount: typed > 0 ? typed : 0.01 });
        if (!live) return;
        const closed = result && !result.allowed && (result.reason === 'active-cap' || typed > 0);
        setBlock(closed ? result : null);
      } catch { if (live) setBlock(null); }
    }, 250);
    return () => { live = false; clearTimeout(timer); };
  }, [active, p.type, p.amount, p.balanceId]);
  return block;
}

export function depositBlockText(block, money) {
  if (!block) return '';
  if (block.reason === 'active-cap') return `Deposits are closed. Your challenge has reached Level ${block.maxLevel}, the halfway level of its ${block.totalLevels}-level plan. Keep growing it through trading.`;
  return `This deposit would fund Level ${block.fundedLevel}, but your ${block.totalLevels}-level challenge only allows funding up to Level ${block.maxLevel}.${block.maximum > 0 ? ` The most you can add now is ${money(block.maximum)}.` : ''}`;
}
