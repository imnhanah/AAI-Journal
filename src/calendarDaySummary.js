export function netDayCashMovement(movements = []) {
  return movements.reduce((total, movement) => {
    const amount = Number(movement.amount);
    if (!Number.isFinite(amount)) return total;
    return total + (movement.type === 'deposit' ? Math.abs(amount) : -Math.abs(amount));
  }, 0);
}
