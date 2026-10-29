export function disclosurePair(items, id, columns = 2) {
  const index = items.findIndex(item => item.id === id);
  if (index < 0) return {};
  const width = columns > 1 ? 2 : 1;
  const start = Math.floor(index / width) * width;
  return Object.fromEntries(items.slice(start, start + width).map(item => [item.id, true]));
}

export function disclosureColumns(board) {
  return board ? getComputedStyle(board).gridTemplateColumns.split(' ').filter(Boolean).length : 1;
}
