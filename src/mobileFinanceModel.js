// Display helpers for the phone Finance screen. Nothing here changes a stored value.
const monthLabel = key => new Date(`${key}-15T12:00:00`).toLocaleDateString('en-GB',{month:'long',year:'numeric'});

// Groups already-sorted movements by month. Counts use the whole filtered list,
// so a month cut short by "Show older movements" still reports its real total.
export function financeMonthGroups(movements = [], allMovements = movements) {
  const groups = [];
  for (const movement of movements) {
    const key = String(movement.isoDate || '').slice(0,7);
    let group = groups.at(-1);
    if (!group || group.key !== key) { group = {key,label:monthLabel(key),items:[],count:allMovements.filter(item => String(item.isoDate || '').slice(0,7) === key).length}; groups.push(group); }
    group.items.push(movement);
  }
  return groups;
}

export const financeMovementSign = type => type === 'deposit' ? '+' : type === 'withdrawal' ? '-' : '';

export function financeMovementIssue({amount,date,requiresSavings,savingsId,balanceId}) {
  if (!(Number(amount) > 0)) return 'Enter an amount greater than 0.';
  if (!date) return 'Pick a date.';
  if (requiresSavings && !savingsId) return 'Choose a savings account.';
  if (!balanceId) return 'Choose an account.';
  return '';
}

export const addToAmount = (amount,value) => String(Math.round(((Number(amount) || 0) + value) * 100) / 100);
