// The entry panel stays mounted so its two forms can keep independent drafts.
// A new create or edit request still needs a deliberate hydration boundary;
// otherwise a persistent form would keep the values from its first mount.
export function beginEntryEditor(previous = {}, { editing = null, draft = null } = {}) {
  return {
    version: (Number(previous.version) || 0) + 1,
    editing: editing || null,
    draft: draft || null,
  };
}

export function clearEntryEditor(previous = {}) {
  return { ...previous, editing: null, draft: null };
}
