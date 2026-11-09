// Stage 1 foundation for Case Study relationships. This module is deliberately
// UI-free: it keeps relationships in the existing profile Case Study workspace
// and gives later screens one safe, small CRUD API to use.

export const CASE_STUDY_CONNECTION_RELATIONSHIPS = Object.freeze([
  { id:'supports', label:'Supports', directional:true },
  { id:'contradicts', label:'Contradicts', directional:true },
  { id:'builds-on', label:'Builds on', directional:true },
  { id:'related-to', label:'Related to', directional:false },
  { id:'alternative-approach', label:'Alternative approach', directional:false },
]);

const relationshipById = new Map(CASE_STUDY_CONNECTION_RELATIONSHIPS.map(item => [item.id, item]));
const text = value => typeof value === 'string' ? value.trim() : '';
const validId = value => text(value);
const caseStudyEndpoint = value => {
  const id=validId(value?.id);
  return value?.type === 'case-study' && id ? { type:'case-study', id } : null;
};

const uuid = () => {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, character => {
    const random=Math.floor(Math.random()*16);
    return (character === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
};

export class CaseStudyConnectionError extends Error {
  constructor(message, code='invalid-connection') { super(message); this.name='CaseStudyConnectionError'; this.code=code; }
}

export const normaliseCaseStudyConnections = raw => (Array.isArray(raw) ? raw : []).flatMap(item => {
  const source=caseStudyEndpoint(item?.source), target=caseStudyEndpoint(item?.target);
  const relationship=text(item?.relationship);
  const id=validId(item?.id);
  if (!id || !source || !target || source.id === target.id || !relationshipById.has(relationship)) return [];
  return [{
    id, source, target, relationship,
    explanation:text(item.explanation),
    createdAt:text(item.createdAt) || null,
    updatedAt:text(item.updatedAt) || text(item.createdAt) || null,
  }];
});

export const isDirectionalCaseStudyRelationship = relationship => relationshipById.get(relationship)?.directional === true;

const connectionKey = ({ source, target, relationship }) => {
  const endpoints=isDirectionalCaseStudyRelationship(relationship) ? [source.id,target.id] : [source.id,target.id].sort((left,right)=>left.localeCompare(right));
  return `${relationship}:${endpoints.join(':')}`;
};

const assertWorkspaceEndpoint = (workspace, endpoint, label) => {
  if (!endpoint) throw new CaseStudyConnectionError(`${label} must be an existing Case Study.`, 'invalid-endpoint');
  if (!Array.isArray(workspace?.studies) || !workspace.studies.some(study=>study?.id===endpoint.id)) throw new CaseStudyConnectionError(`${label} Case Study is unavailable.`, 'missing-study');
};

const assertConnectionInput = (workspace, fields, { excludingId=null }={}) => {
  const source=caseStudyEndpoint(fields?.source), target=caseStudyEndpoint(fields?.target);
  if (!source || !target) throw new CaseStudyConnectionError('Choose two Case Studies to connect.', 'invalid-endpoint');
  assertWorkspaceEndpoint(workspace,source,'Source');
  assertWorkspaceEndpoint(workspace,target,'Target');
  if (source.id === target.id) throw new CaseStudyConnectionError('A Case Study cannot connect to itself.', 'self-connection');
  const relationship=text(fields?.relationship);
  if (!relationshipById.has(relationship)) throw new CaseStudyConnectionError('Choose a valid relationship type.', 'invalid-relationship');
  const explanation=text(fields?.explanation);
  if (!explanation) throw new CaseStudyConnectionError('Explain why these Case Studies are connected.', 'missing-explanation');
  const candidate={source,target,relationship};
  if ((workspace.connections || []).some(connection => connection.id!==excludingId && connectionKey(connection)===connectionKey(candidate))) throw new CaseStudyConnectionError('This relationship already exists.', 'duplicate-connection');
  return { ...candidate, explanation };
};

const nextWorkspace = (workspace, connections) => ({ ...workspace, connections:normaliseCaseStudyConnections(connections) });

export const createCaseStudyConnection = (workspace, fields, { id=uuid(), timestamp=new Date().toISOString() }={}) => {
  const valid=assertConnectionInput(workspace,fields);
  const connection={ id:validId(id) || uuid(), ...valid, createdAt:timestamp, updatedAt:timestamp };
  if ((workspace.connections || []).some(item=>item.id===connection.id)) throw new CaseStudyConnectionError('Connection ID already exists.', 'duplicate-id');
  return { connection, workspace:nextWorkspace(workspace,[...(workspace.connections || []),connection]) };
};

// Endpoints are immutable after creation. Editing can change only the
// relationship and explanation, preventing accidental rewiring.
export const updateCaseStudyConnection = (workspace, id, fields, { timestamp=new Date().toISOString() }={}) => {
  const existing=(workspace.connections || []).find(item=>item.id===id);
  if (!existing) throw new CaseStudyConnectionError('Connection not found.', 'missing-connection');
  const valid=assertConnectionInput(workspace,{ source:existing.source, target:existing.target, relationship:fields?.relationship, explanation:fields?.explanation },{excludingId:id});
  const connection={ ...existing, relationship:valid.relationship, explanation:valid.explanation, updatedAt:timestamp };
  return { connection, workspace:nextWorkspace(workspace,(workspace.connections || []).map(item=>item.id===id ? connection : item)) };
};

export const removeCaseStudyConnection = (workspace, id) => nextWorkspace(workspace,(workspace.connections || []).filter(item=>item.id!==id));

// Permanent deletion removes only touching relationships. Archive is a
// separate study state and intentionally leaves relationship records intact.
export const removeConnectionsForCaseStudy = (workspace, studyId) => nextWorkspace(workspace,(workspace.connections || []).filter(item=>item.source?.id!==studyId && item.target?.id!==studyId));

export const caseStudyConnectionsForStudy = (workspace, studyId) => normaliseCaseStudyConnections(workspace?.connections).filter(connection=>connection.source.id===studyId || connection.target.id===studyId);

export const isUsableCaseStudyConnection = (workspace, connection) => {
  const ids=new Set((workspace?.studies || []).map(study=>study?.id));
  return !!connection && ids.has(connection.source?.id) && ids.has(connection.target?.id);
};
