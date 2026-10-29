// Session-only UI memory. Never stores credentials or writes to the journal.
export function createNavigationState(owner) {
  const entries = new Map();
  const key = (workspace, page, field) => JSON.stringify([workspace, page, field]);
  return {
    read(user, workspace, page, field) {
      return user === owner ? entries.get(key(workspace, page, field)) : undefined;
    },
    write(user, workspace, page, field, value) {
      if (user === owner && workspace) entries.set(key(workspace, page, field), value);
    },
    clear() { entries.clear(); },
  };
}
