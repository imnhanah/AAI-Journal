const externalImageSource = value => typeof value === 'string' && /^(data:image|https?:\/\/)/i.test(value);

// Evidence image references may be browser URLs, data URLs, or IndexedDB keys.
// Keep this resolver data-only so every library surface makes the same choice
// without changing any stored study or evidence records.
export const evidenceImageReference = evidence => {
  if (!evidence || typeof evidence !== 'object') return '';
  if (typeof evidence.cloudRef === 'string' && evidence.cloudRef) return evidence.cloudRef;
  if (typeof evidence.url === 'string' && evidence.url) return evidence.url;
  if (typeof evidence.documentImageRef === 'string' && evidence.documentImageRef) return evidence.documentImageRef;
  return externalImageSource(evidence.source) ? evidence.source : '';
};

export const resolveCaseStudyCover = (study, evidence = []) => {
  const items = Array.isArray(evidence) ? evidence : [];
  const byId = new Map(items.map(item => [item?.id, item]));
  // These legacy-compatible fields are deliberately read-only here. No cover
  // selection UI or persisted data is introduced by thumbnail rendering.
  const explicitId = study?.coverEvidenceId || study?.coverImageId || study?.coverId;
  const explicit = explicitId ? byId.get(explicitId) : null;
  if (evidenceImageReference(explicit)) return explicit;

  for (const evidenceId of study?.evidenceIds || []) {
    const linked = byId.get(evidenceId);
    if (evidenceImageReference(linked)) return linked;
  }
  return null;
};
