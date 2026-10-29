// Stable unique-key pagination. Never mistake a failed page for an empty one.
export async function readAllPages(fetchPage, size = 500) {
  const rows = [];
  let after = null;
  while (true) {
    const {data,error} = await fetchPage(after, size);
    if (error) throw new Error(error.message || 'Could not load journal page.');
    if (!Array.isArray(data)) throw new Error('Invalid journal page.');
    if (!data.length) return rows;
    const next = data[data.length - 1].id;
    if (!next || (after !== null && next <= after)) throw new Error('Journal pagination did not advance.');
    rows.push(...data);
    after = next;
    // A project can impose a row cap below the requested page size.
    // Only an empty page proves the ordered history is complete.
  }
}
