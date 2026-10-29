// In-memory navigation state, owned by one mounted authenticated app session.
// Never persisted to localStorage or shared between users/workspaces.
export function createBacktestViewState(owner) {
  const views = new Map();
  return {
    read(user, workspace) { return user === owner ? views.get(workspace) : undefined; },
    write(user, workspace, view) {
      if (user !== owner || !workspace || !view.loaded) return;
      views.set(workspace, view);
    },
    clear() { views.clear(); },
  };
}

export function reconcileBacktestView(data, view = {}) {
  const ids = new Set(data.runs.map(run => run.id));
  const active = ids.has(view.active) ? view.active : null;
  return { active, phoneLog:!!active && !!view.phoneLog,
    expanded:Object.fromEntries(Object.entries(view.expanded || {}).filter(([id]) => ids.has(id))) };
}
