// Session-only expansion state for Challenge cards. The NavigationSession owns
// its lifetime, so navigation keeps this state while a browser refresh starts
// from the display-order default again.
const uniqueIds = values => [...new Set((Array.isArray(values) ? values : []).filter(id => typeof id === 'string' && id))];

export function normalizeChallengeExpansion(value, cardIds = []) {
  const valid = new Set(uniqueIds(cardIds));
  return {
    initialized: value?.initialized === true,
    ids: uniqueIds(value?.ids).filter(id => valid.has(id)),
  };
}

export function initialChallengeExpansion(cards = []) {
  const firstActive = cards.find(card => card?.active && card?.id);
  return {initialized:true, ids:firstActive ? [firstActive.id] : []};
}

// Async challenge records must all report ready before a fresh session picks
// its default. An empty/loading pass is deliberately not an initialization.
export function initializeChallengeExpansion(value, cards = []) {
  const state = normalizeChallengeExpansion(value, cards.map(card => card?.id));
  if (state.initialized || !cards.length || cards.some(card => card?.ready !== true)) return state;
  return initialChallengeExpansion(cards);
}

export function setChallengeExpanded(value, cardIds, id, next) {
  const state = normalizeChallengeExpansion(value, cardIds);
  const current = state.ids.includes(id);
  const expanded = typeof next === 'function' ? next(current) : next;
  const ids = expanded
    ? uniqueIds([...state.ids, id])
    : state.ids.filter(item => item !== id);
  return {initialized:true, ids};
}
