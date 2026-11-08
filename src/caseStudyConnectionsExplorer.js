import { CASE_STUDY_CONNECTION_RELATIONSHIPS, normaliseCaseStudyConnections } from './caseStudyConnections.js';

const relationshipById=new Map(CASE_STUDY_CONNECTION_RELATIONSHIPS.map(item=>[item.id,item]));
const title=study=>String(study?.title || '').trim() || 'Untitled study';

export const buildConnectionsExplorerGraph = workspace => {
  const studies=Array.isArray(workspace?.studies) ? workspace.studies : [];
  const nodes=studies.map(study=>({ id:study.id, title:title(study), status:study.status || 'Draft', archived:!!study.archived }));
  const known=new Set(nodes.map(node=>node.id));
  const edges=normaliseCaseStudyConnections(workspace?.connections).filter(edge=>known.has(edge.source.id)&&known.has(edge.target.id)).map(edge=>({
    ...edge,
    label:relationshipById.get(edge.relationship)?.label || edge.relationship,
    directional:relationshipById.get(edge.relationship)?.directional === true,
  }));
  const counts=new Map(nodes.map(node=>[node.id,0]));
  edges.forEach(edge=>{counts.set(edge.source.id,(counts.get(edge.source.id)||0)+1);counts.set(edge.target.id,(counts.get(edge.target.id)||0)+1);});
  return { nodes:nodes.map(node=>({...node,connectionCount:counts.get(node.id)||0})), edges };
};

export const filterConnectionsExplorerGraph = (graph,{query='',relationship='All',includeArchived=false}={}) => {
  const term=String(query).trim().toLocaleLowerCase();
  const permitted=new Set(graph.nodes.filter(node=>includeArchived||!node.archived).map(node=>node.id));
  const relationshipEdges=graph.edges.filter(edge=>permitted.has(edge.source.id)&&permitted.has(edge.target.id)&&(relationship==='All'||edge.relationship===relationship));
  if (!term) return { nodes:graph.nodes.filter(node=>permitted.has(node.id)), edges:relationshipEdges };
  const matched=new Set(graph.nodes.filter(node=>permitted.has(node.id)&&node.title.toLocaleLowerCase().includes(term)).map(node=>node.id));
  const edges=relationshipEdges.filter(edge=>matched.has(edge.source.id)||matched.has(edge.target.id));
  const visible=new Set([...matched,...edges.flatMap(edge=>[edge.source.id,edge.target.id])]);
  return { nodes:graph.nodes.filter(node=>visible.has(node.id)), edges };
};

export const initialConnectionsExplorerLayout = graph => {
  return layoutConnectionsExplorerGraph(graph).positions;
};

const NODE_WIDTH=164;
const NODE_HEIGHT=66;
const HORIZONTAL_GAP=82;
const VERTICAL_GAP=62;
const COMPONENT_GAP=120;

const ordered = values => [...values].sort((left,right)=>String(left.title || left).localeCompare(String(right.title || right)) || String(left.id || left).localeCompare(String(right.id || right)));

const componentsFor = graph => {
  const nodesById=new Map(graph.nodes.map(node=>[node.id,node]));
  const adjacency=new Map(graph.nodes.map(node=>[node.id,[]]));
  graph.edges.forEach(edge=>{adjacency.get(edge.source.id)?.push(edge.target.id);adjacency.get(edge.target.id)?.push(edge.source.id);});
  const seen=new Set(); const groups=[];
  ordered(graph.nodes).forEach(node=>{
    if(seen.has(node.id)) return;
    const ids=[]; const queue=[node.id]; seen.add(node.id);
    while(queue.length){const id=queue.shift();ids.push(id);ordered((adjacency.get(id)||[]).map(value=>nodesById.get(value)).filter(Boolean)).forEach(next=>{if(!seen.has(next.id)){seen.add(next.id);queue.push(next.id);}});}
    groups.push(ids.map(id=>nodesById.get(id)));
  });
  return groups.sort((left,right)=>right.length-left.length || String(left[0]?.title).localeCompare(String(right[0]?.title)));
};

const localComponentLayout = (nodes, graph) => {
  const ids=new Set(nodes.map(node=>node.id));
  const adjacency=new Map(nodes.map(node=>[node.id,[]]));
  graph.edges.forEach(edge=>{if(ids.has(edge.source.id)&&ids.has(edge.target.id)){adjacency.get(edge.source.id).push(edge.target.id);adjacency.get(edge.target.id).push(edge.source.id);}});
  const root=ordered(nodes).sort((left,right)=>(adjacency.get(right.id).length-adjacency.get(left.id).length)||left.title.localeCompare(right.title))[0];
  const levels=[]; const seen=new Set([root.id]); let frontier=[root.id];
  while(frontier.length){levels.push(frontier);const next=[];frontier.forEach(id=>ordered((adjacency.get(id)||[]).map(value=>nodes.find(node=>node.id===value)).filter(Boolean)).forEach(node=>{if(!seen.has(node.id)){seen.add(node.id);next.push(node.id);}}));frontier=next;}
  const result={}; const rowHeight=Math.max(NODE_HEIGHT+VERTICAL_GAP,120);
  levels.forEach((level,column)=>level.forEach((id,index)=>{result[id]={x:column*(NODE_WIDTH+HORIZONTAL_GAP),y:(index-(level.length-1)/2)*rowHeight};}));
  const points=Object.values(result); const minY=Math.min(...points.map(point=>point.y-NODE_HEIGHT/2)); const maxY=Math.max(...points.map(point=>point.y+NODE_HEIGHT/2));
  return { positions:result, width:(levels.length-1)*(NODE_WIDTH+HORIZONTAL_GAP)+NODE_WIDTH, height:maxY-minY, minY };
};

export const fitConnectionsExplorerLayout = (positions,{width=1000,height=620,padding=70}={}) => {
  const points=Object.values(positions);
  if(!points.length) return { zoom:1, pan:{x:0,y:0} };
  const minX=Math.min(...points.map(point=>point.x-NODE_WIDTH/2)); const maxX=Math.max(...points.map(point=>point.x+NODE_WIDTH/2));
  const minY=Math.min(...points.map(point=>point.y-NODE_HEIGHT/2)); const maxY=Math.max(...points.map(point=>point.y+NODE_HEIGHT/2));
  const zoom=Math.min(1.15,Math.max(.42,Math.min((width-padding*2)/(maxX-minX||1),(height-padding*2)/(maxY-minY||1))));
  return { zoom:Number(zoom.toFixed(2)), pan:{x:Number((width/2-((minX+maxX)/2)*zoom).toFixed(2)),y:Number((height/2-((minY+maxY)/2)*zoom).toFixed(2))} };
};

// Components are laid out separately, then packed in deterministic rows. The
// resulting virtual canvas can be fitted at any viewport size without moving
// relationship endpoints or changing the saved graph data.
export const layoutConnectionsExplorerGraph = graph => {
  const position={}; let cursorX=0,cursorY=0,rowHeight=0;
  componentsFor(graph).forEach(group=>{
    const local=localComponentLayout(group,graph);
    if(cursorX&&cursorX+local.width>1500){cursorX=0;cursorY+=rowHeight+COMPONENT_GAP;rowHeight=0;}
    Object.entries(local.positions).forEach(([id,point])=>{position[id]={x:cursorX+point.x+NODE_WIDTH/2,y:cursorY+point.y-local.minY+NODE_HEIGHT/2};});
    cursorX+=local.width+COMPONENT_GAP; rowHeight=Math.max(rowHeight,local.height);
  });
  return { positions:position, viewport:fitConnectionsExplorerLayout(position), components:componentsFor(graph).map(group=>group.map(node=>node.id)) };
};

export const connectedNodeIds = (graph,nodeId) => new Set(graph.edges.filter(edge=>edge.source.id===nodeId||edge.target.id===nodeId).flatMap(edge=>[edge.source.id,edge.target.id]));

export const explorerRelationship = id => relationshipById.get(id) || null;
