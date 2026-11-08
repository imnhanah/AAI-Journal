import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Focus, Maximize2, Minus, MousePointer2, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { CASE_STUDY_CONNECTION_RELATIONSHIPS } from './caseStudyConnections.js';
import { buildConnectionsExplorerGraph, connectedNodeIds, explorerRelationship, filterConnectionsExplorerGraph, fitConnectionsExplorerLayout, layoutConnectionsExplorerGraph } from './caseStudyConnectionsExplorer.js';
import './caseStudyConnectionsExplorer.css';

const GRAPH_WIDTH=1000;
const GRAPH_HEIGHT=620;
const NODE_WIDTH=164;
const NODE_HEIGHT=66;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

const pathFor=(from,to)=>{
  const dx=to.x-from.x,dy=to.y-from.y, length=Math.hypot(dx,dy)||1;
  const start={x:from.x+(dx/length)*(NODE_WIDTH/2),y:from.y+(dy/length)*(NODE_HEIGHT/2)};
  const end={x:to.x-(dx/length)*(NODE_WIDTH/2),y:to.y-(dy/length)*(NODE_HEIGHT/2)};
  const bend=Math.min(100,Math.max(34,Math.abs(dx)*.2));
  return `M ${start.x} ${start.y} C ${start.x+bend} ${start.y}, ${end.x-bend} ${end.y}, ${end.x} ${end.y}`;
};
const labelPointFor=(edge,edges,from,to)=>{
  const pair=[edge.source.id,edge.target.id].sort().join(':');
  const siblings=edges.filter(item=>[item.source.id,item.target.id].sort().join(':')===pair);
  const index=siblings.findIndex(item=>item.id===edge.id);
  const offset=(index-(siblings.length-1)/2)*20-10;
  const dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy)||1;
  return {x:(from.x+to.x)/2+(-dy/length)*offset,y:(from.y+to.y)/2+(dx/length)*offset};
};

export default function CaseStudyConnectionsExplorer({workspace,onBack,onOpenStudy}) {
  const graph=useMemo(()=>buildConnectionsExplorerGraph(workspace),[workspace]);
  const [query,setQuery]=useState('');
  const [relationship,setRelationship]=useState('All');
  const [includeArchived,setIncludeArchived]=useState(false);
  const [selected,setSelected]=useState(null);
  const arrangement=useMemo(()=>layoutConnectionsExplorerGraph(graph),[graph]);
  const [zoom,setZoom]=useState(()=>arrangement.viewport.zoom);
  const [pan,setPan]=useState(()=>arrangement.viewport.pan);
  const [positions,setPositions]=useState(()=>arrangement.positions);
  const canvasRef=useRef(null);
  const pointerRef=useRef(null);
  const manuallySelected=useRef(false);
  const visible=useMemo(()=>filterConnectionsExplorerGraph(graph,{query,relationship,includeArchived}),[graph,query,relationship,includeArchived]);
  const visibleIds=useMemo(()=>new Set(visible.nodes.map(node=>node.id)),[visible.nodes]);
  const selectedNode=selected?.kind==='node' ? graph.nodes.find(node=>node.id===selected.id) || null : null;
  const selectedEdge=selected?.kind==='edge' ? graph.edges.find(edge=>edge.id===selected.id) || null : null;
  const connected=useMemo(()=>selectedNode ? connectedNodeIds(graph,selectedNode.id) : new Set(),[graph,selectedNode]);

  useEffect(()=>{ setPositions(arrangement.positions); setZoom(arrangement.viewport.zoom); setPan(arrangement.viewport.pan); manuallySelected.current=false; setSelected(null); },[arrangement]);
  useEffect(()=>{
    const validNode=selected?.kind==='node'&&visibleIds.has(selected.id);
    const validEdge=selected?.kind==='edge'&&visible.edges.some(edge=>edge.id===selected.id);
    if(validNode||validEdge) return;
    if(!selected&&manuallySelected.current) return;
    const candidate=[...visible.nodes].sort((left,right)=>right.connectionCount-left.connectionCount||left.title.localeCompare(right.title))[0];
    if(candidate) setSelected({kind:'node',id:candidate.id});
  },[selected,visible.nodes,visible.edges,visibleIds]);

  const point=event=>{
    const rect=canvasRef.current?.getBoundingClientRect();
    if(!rect) return {x:0,y:0};
    return {x:((event.clientX-rect.left)/rect.width)*GRAPH_WIDTH,y:((event.clientY-rect.top)/rect.height)*GRAPH_HEIGHT};
  };
  const reset=()=>{setPositions(arrangement.positions);setPan(arrangement.viewport.pan);setZoom(arrangement.viewport.zoom);};
  const focusSelected=()=>{
    if(!selectedNode) return;
    const current=positions[selectedNode.id]; if(!current) return;
    setPan({x:GRAPH_WIDTH/2-current.x*zoom,y:GRAPH_HEIGHT/2-current.y*zoom});
  };
  const beginPan=event=>{ if(event.target===event.currentTarget){pointerRef.current={kind:'pan',start:point(event),pan};event.currentTarget.setPointerCapture?.(event.pointerId);manuallySelected.current=true;setSelected(null);} };
  const beginNodeDrag=(event,id)=>{ event.stopPropagation(); const cursor=point(event); const current=positions[id]||{x:500,y:310}; pointerRef.current={kind:'node',id,offset:{x:cursor.x/zoom-pan.x/zoom-current.x,y:cursor.y/zoom-pan.y/zoom-current.y}}; event.currentTarget.setPointerCapture?.(event.pointerId); manuallySelected.current=true; setSelected({kind:'node',id}); };
  const move=event=>{
    const active=pointerRef.current; if(!active) return;
    const cursor=point(event);
    if(active.kind==='pan') { const start=active.start; setPan({x:active.pan.x+(cursor.x-start.x),y:active.pan.y+(cursor.y-start.y)}); }
    if(active.kind==='node') setPositions(current=>({...current,[active.id]:{x:clamp((cursor.x-pan.x)/zoom-active.offset.x,-1200,2600),y:clamp((cursor.y-pan.y)/zoom-active.offset.y,-900,1800)}}));
  };
  const endPointer=()=>{pointerRef.current=null;};
  const zoomBy=delta=>setZoom(value=>clamp(Number((value+delta).toFixed(2)),.55,1.7));

  return <section className="cse-explorer" aria-label="Case Study Connections Explorer">
    <header className="cse-explorer__head">
      <button className="case-back" onClick={onBack}><ArrowLeft size={16}/>Back to Library</button>
      <div><p className="case-eyebrow">Research map</p><h2>Connections Explorer</h2><p>Explore validated relationships across your Case Studies without changing them.</p></div>
      <span className="cse-explorer__count">{visible.nodes.length} studies · {visible.edges.length} relationships</span>
    </header>
    <div className="cse-explorer__controls">
      <label className="case-search"><Search size={16}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search Case Studies" aria-label="Search Case Studies"/></label>
      <div className="cse-explorer__filter" role="group" aria-label="Filter relationship type"><SlidersHorizontal size={15}/>{[{id:'All',label:'All'},...CASE_STUDY_CONNECTION_RELATIONSHIPS].map(item=><button key={item.id} className={relationship===item.id?'is-active':''} aria-pressed={relationship===item.id} onClick={()=>setRelationship(item.id)}>{item.label}</button>)}</div>
      <label className="cse-explorer__archive"><input type="checkbox" checked={includeArchived} onChange={event=>setIncludeArchived(event.target.checked)}/>Show archived</label>
      <button className="case-button case-button--quiet" onClick={()=>{setQuery('');setRelationship('All');setIncludeArchived(false);manuallySelected.current=false;setSelected(null);}}><X size={15}/>Clear filters</button>
    </div>
    <div className="cse-explorer__layout">
      <div className="cse-graph-card">
        <div className="cse-graph-card__toolbar"><span><MousePointer2 size={15}/>Drag nodes · scroll to zoom</span><div><button aria-label="Zoom out" onClick={()=>zoomBy(-.15)}><Minus size={15}/></button><b>{Math.round(zoom*100)}%</b><button aria-label="Zoom in" onClick={()=>zoomBy(.15)}><Plus size={15}/></button><button onClick={focusSelected} disabled={!selectedNode}><Focus size={15}/>Focus</button><button onClick={()=>{const fitted=fitConnectionsExplorerLayout(positions,{width:GRAPH_WIDTH,height:GRAPH_HEIGHT});setPan(fitted.pan);setZoom(fitted.zoom);}}><Maximize2 size={15}/>Fit</button><button onClick={reset}>Reset</button></div></div>
        {!visible.nodes.length ? <div className="cse-graph-empty"><h3>No matching Case Studies</h3><p>Adjust the search or filters to return to the full relationship map.</p></div> : <svg ref={canvasRef} className="cse-graph" viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`} role="application" aria-label="Interactive Case Study relationship graph" onPointerDown={beginPan} onPointerMove={move} onPointerUp={endPointer} onPointerCancel={endPointer} onWheel={event=>{event.preventDefault();zoomBy(event.deltaY>0?-.08:.08);}}>
          <defs><marker id="cse-explorer-arrow-supports" markerWidth="14" markerHeight="14" refX="13" refY="5" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,10 L12,5 z" className="cse-graph__arrow cse-graph__arrow--supports"/></marker><marker id="cse-explorer-arrow-contradicts" markerWidth="14" markerHeight="14" refX="13" refY="5" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,10 L12,5 z" className="cse-graph__arrow cse-graph__arrow--contradicts"/></marker><marker id="cse-explorer-arrow-builds-on" markerWidth="14" markerHeight="14" refX="13" refY="5" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,10 L12,5 z" className="cse-graph__arrow cse-graph__arrow--builds-on"/></marker></defs>
          <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
            {visible.edges.map(edge=>{const from=positions[edge.source.id],to=positions[edge.target.id];if(!from||!to)return null;const label=labelPointFor(edge,visible.edges,from,to);const active=selectedEdge?.id===edge.id;const linked=selectedNode&&(edge.source.id===selectedNode.id||edge.target.id===selectedNode.id);return <g key={edge.id} className={`cse-graph__edge cse-graph__edge--${edge.relationship}${active?' is-selected':''}${linked?' is-linked':''}`} onPointerDown={event=>{event.stopPropagation();manuallySelected.current=true;setSelected({kind:'edge',id:edge.id});}}><path d={pathFor(from,to)} markerEnd={edge.directional?`url(#cse-explorer-arrow-${edge.relationship})`:undefined}/><text x={label.x} y={label.y}>{edge.label}</text></g>;})}
            {visible.nodes.map(node=>{const position=positions[node.id]||{x:500,y:310};const active=selectedNode?.id===node.id;const muted=selectedNode&&!connected.has(node.id);return <g key={node.id} transform={`translate(${position.x-NODE_WIDTH/2} ${position.y-NODE_HEIGHT/2})`} className={`cse-graph__node${active?' is-selected':''}${muted?' is-muted':''}`} role="button" tabIndex="0" aria-label={`Select ${node.title}`} onPointerDown={event=>beginNodeDrag(event,node.id)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();manuallySelected.current=true;setSelected({kind:'node',id:node.id});}}}><rect width={NODE_WIDTH} height={NODE_HEIGHT} rx="12"/><text x="14" y="27" className="cse-graph__node-title">{node.title.length>22?`${node.title.slice(0,22)}…`:node.title}</text><text x="14" y="48" className="cse-graph__node-meta">{node.archived?'Archived · ':''}{node.status} · {node.connectionCount} link{node.connectionCount===1?'':'s'}</text></g>;})}
          </g>
        </svg>}
      </div>
      <aside className="cse-explorer__details" aria-live="polite">
        {!selectedNode&&!selectedEdge&&<div className="cse-details-empty"><Focus size={22}/><h3>Select a study or relationship</h3><p>Choose a node for its connected research, or an edge for relationship context.</p></div>}
        {selectedNode&&<NodeDetails node={selectedNode} graph={graph} onOpen={()=>onOpenStudy(selectedNode.id)} onSelectEdge={id=>setSelected({kind:'edge',id})}/>} 
        {selectedEdge&&<EdgeDetails edge={selectedEdge} graph={graph} onOpen={onOpenStudy}/>} 
      </aside>
    </div>
  </section>;
}

function NodeDetails({node,graph,onOpen,onSelectEdge}) {
  const links=graph.edges.filter(edge=>edge.source.id===node.id||edge.target.id===node.id);
  return <><header className="cse-details__head"><p className="case-eyebrow">Case Study</p><h3>{node.title}</h3><div><span>{node.status}</span>{node.archived&&<span className="is-archived">Archived</span>}</div></header><button className="case-button case-button--primary" onClick={onOpen}>Open Study</button><section><h4>{links.length} connection{links.length===1?'':'s'}</h4>{links.length?links.map(edge=>{const other=edge.source.id===node.id?edge.target.id:edge.source.id;const target=graph.nodes.find(item=>item.id===other);const relationship=explorerRelationship(edge.relationship);const direction=relationship?.directional?(edge.source.id===node.id?'Outgoing':'Incoming'):'Mutual';return <button key={edge.id} className="cse-details__link" onClick={()=>onSelectEdge(edge.id)}><span><strong>{target?.title || 'Unavailable study'}</strong><small>{direction} · {edge.label}</small></span><p>{edge.explanation}</p></button>}):<p className="cse-muted">This study has no saved connections yet.</p>}</section></>;
}

function EdgeDetails({edge,graph,onOpen}) {
  const source=graph.nodes.find(node=>node.id===edge.source.id); const target=graph.nodes.find(node=>node.id===edge.target.id);
  return <><header className="cse-details__head"><p className="case-eyebrow">Relationship</p><h3>{edge.label}</h3><div><span>{edge.directional?'Directional':'Mutual'}</span></div></header><section className="cse-details__route"><button onClick={()=>source&&onOpen(source.id)}>{source?.title || 'Unavailable study'}</button><span>{edge.directional?'→':'↔'}</span><button onClick={()=>target&&onOpen(target.id)}>{target?.title || 'Unavailable study'}</button></section><section><h4>Explanation</h4><p className="cse-details__explanation">{edge.explanation}</p></section></>;
}
