export const RICH_DOCUMENT_VERSION = 1;

export const emptyRichDocument = () => ({ version:RICH_DOCUMENT_VERSION, content:{ type:'doc', content:[{ type:'paragraph' }] } });

const paragraph = text => ({ type:'paragraph', content:text ? [{ type:'text', text }] : undefined });
const textBlocks = text => String(text || '').replace(/\r\n?/g, '\n').split(/\n{2,}/).map(block => paragraph(block.replace(/\n/g, ' ')));
const validContent = value => value && typeof value === 'object' && value.type === 'doc' && Array.isArray(value.content);

export const normaliseRichDocument = value => {
  if (!value || typeof value !== 'object' || value.version !== RICH_DOCUMENT_VERSION || !validContent(value.content)) return null;
  return { version:RICH_DOCUMENT_VERSION, content:value.content };
};

export const legacyOverviewText = (study, sectionName = 'Overview') => {
  const notes = study?.sectionNotes && typeof study.sectionNotes === 'object' ? study.sectionNotes : {};
  const note = typeof notes[sectionName] === 'string' ? notes[sectionName] : typeof notes.Overview === 'string' ? notes.Overview : '';
  const body = typeof study?.body === 'string' ? study.body : '';
  if (note && body && note !== body) return { note, body, conflict:true };
  return { note:note || body, body:'', conflict:false };
};

export const migrateRichDocument = (study, sectionName) => {
  const current = normaliseRichDocument(study?.richDocument);
  if (current) return current;
  const legacy = legacyOverviewText(study, sectionName);
  const content = [...textBlocks(legacy.note)];
  if (legacy.conflict) content.push({ type:'heading', attrs:{ level:2 }, content:[{ type:'text', text:'Legacy overview' }] }, ...textBlocks(legacy.body));
  return { version:RICH_DOCUMENT_VERSION, content:{ type:'doc', content:content.length ? content : emptyRichDocument().content.content } };
};

// A study used to store only plain text in `sectionNotes` (and, for the first
// section, `body`).  Keep those fields intact and lazily expose a structured
// document for the editor.  We deliberately do not bulk-migrate old studies:
// a document is written only after the user changes that section.
export const migrateSectionRichDocument = (study, sectionName, sectionIndex = 0) => {
  const stored = normaliseRichDocument(study?.sectionDocuments?.[sectionName]);
  if (stored) return stored;
  const note = typeof study?.sectionNotes?.[sectionName] === 'string' ? study.sectionNotes[sectionName] : '';
  if (note) return { version:RICH_DOCUMENT_VERSION, content:{ type:'doc', content:textBlocks(note) } };
  if (sectionIndex === 0) return migrateRichDocument(study, sectionName);
  return emptyRichDocument();
};

// Keep structured documents isolated by section while mirroring the first
// section to legacy fields.  The mirror keeps exports and older UI paths
// readable without allowing a later section to overwrite the overview.
export const patchSectionRichDocument = (study, sectionName, sectionIndex, document) => {
  const current = normaliseRichDocument(document) || emptyRichDocument();
  const text = richDocumentText(current);
  const patch = { sectionDocuments:{ ...(study?.sectionDocuments || {}), [sectionName]:current } };
  if (sectionIndex === 0) {
    patch.richDocument = current;
    patch.body = text;
    patch.sectionNotes = { ...(study?.sectionNotes || {}), [sectionName]:text };
  }
  return patch;
};

export const richDocumentFromSections = sections => {
  const content = (sections || []).filter(Boolean).flatMap((section, index) => [{ type:'heading', attrs:{ level:index === 0 ? 1 : 2 }, content:[{ type:'text', text:section }] }, { type:'paragraph' }]);
  return { version:RICH_DOCUMENT_VERSION, content:{ type:'doc', content:content.length ? content : emptyRichDocument().content.content } };
};

export const richDocumentText = document => {
  const walk = node => (node?.content || []).flatMap(child => child.type === 'text' ? [child.text || ''] : [walk(child)]).join(childBreak(node));
  const current = normaliseRichDocument(document) || emptyRichDocument();
  return walk(current.content).replace(/\n{3,}/g, '\n\n').trim();
};
const childBreak = node => ['doc','paragraph','heading','listItem','blockquote','tableCell','tableHeader'].includes(node?.type) ? '\n' : '';

export const isSafeLink = href => {
  try { const url = new URL(href, 'https://journal.local'); return ['http:','https:','mailto:'].includes(url.protocol); } catch { return false; }
};
