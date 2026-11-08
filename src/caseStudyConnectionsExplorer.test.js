import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildConnectionsExplorerGraph, connectedNodeIds, filterConnectionsExplorerGraph, initialConnectionsExplorerLayout, layoutConnectionsExplorerGraph} from './caseStudyConnectionsExplorer.js';

const workspace=()=>({
  studies:[{id:'a',title:'Liquidity sweep',status:'Researching'},{id:'b',title:'Structure response',status:'Validated'},{id:'c',title:'Archived alternative',archived:true,status:'Draft'},{id:'d',title:'Disconnected note',status:'Draft'}],
  connections:[
    {id:'one',source:{type:'case-study',id:'a'},target:{type:'case-study',id:'b'},relationship:'supports',explanation:'The sweep supports the response.'},
    {id:'two',source:{type:'case-study',id:'a'},target:{type:'case-study',id:'c'},relationship:'related-to',explanation:'Alternative context.'},
  ],
});

test('Connections Explorer preserves directional and symmetric relationships without mutating workspace data',()=>{
  const source=workspace(); const before=structuredClone(source); const graph=buildConnectionsExplorerGraph(source);
  assert.equal(graph.edges[0].directional,true); assert.equal(graph.edges[0].label,'Supports');
  assert.equal(graph.edges[1].directional,false); assert.equal(graph.edges[1].label,'Related to');
  assert.deepEqual(source,before);
});

test('Explorer filters archived nodes and relationship/search results without changing saved relationships',()=>{
  const graph=buildConnectionsExplorerGraph(workspace());
  assert.equal(filterConnectionsExplorerGraph(graph,{}).nodes.some(node=>node.id==='c'),false);
  const archived=filterConnectionsExplorerGraph(graph,{includeArchived:true,relationship:'related-to'});
  assert.deepEqual(archived.edges.map(edge=>edge.id),['two']);
  assert.deepEqual(filterConnectionsExplorerGraph(graph,{query:'liquidity'}).nodes.map(node=>node.id).sort(),['a','b']);
});

test('Explorer layout handles connected, disconnected, and empty graphs deterministically',()=>{
  const graph=buildConnectionsExplorerGraph(workspace()); const layout=initialConnectionsExplorerLayout(graph);
  assert.ok(layout.a && layout.d); assert.equal(connectedNodeIds(graph,'a').has('b'),true);
  assert.deepEqual(initialConnectionsExplorerLayout({nodes:[],edges:[]}),{});
});

test('relationship-aware layout forms deterministic separated clusters without overlapping node cards and fits the viewport',()=>{
  const graph=buildConnectionsExplorerGraph(workspace());
  const first=layoutConnectionsExplorerGraph(graph); const second=layoutConnectionsExplorerGraph(graph);
  assert.deepEqual(first,second);
  const points=Object.values(first.positions);
  for(let left=0;left<points.length;left+=1) for(let right=left+1;right<points.length;right+=1) {
    assert.ok(Math.abs(points[left].x-points[right].x)>=164 || Math.abs(points[left].y-points[right].y)>=66);
  }
  assert.ok(first.components.some(component=>component.includes('a')&&component.includes('b')));
  assert.ok(first.components.some(component=>component.length===1&&component[0]==='d'));
  assert.ok(first.viewport.zoom>=.42&&first.viewport.zoom<=1.15);
});

test('Explorer is application-rendered, opens studies through its supplied navigator, and has no native relationship picker',()=>{
  const component=readFileSync(new URL('./CaseStudyConnectionsExplorer.jsx',import.meta.url),'utf8');
  const library=readFileSync(new URL('./CaseStudyLibrary.jsx',import.meta.url),'utf8');
  assert.match(component,/onOpenStudy\(selectedNode\.id\)/);
  assert.match(component,/role="group" aria-label="Filter relationship type"/);
  assert.match(component,/right\.connectionCount-left\.connectionCount/);
  assert.match(component,/if\(!selected&&manuallySelected\.current\) return/);
  assert.match(component,/cse-explorer-arrow-\$\{edge\.relationship\}/);
  assert.doesNotMatch(component,/<select/);
  assert.match(library,/Connections Explorer/);
  assert.match(library,/<CaseStudyConnectionsExplorer workspace=\{workspace\}/);
  assert.match(library,/libraryView !== 'templates' && libraryView !== 'connections' && <header className="case-library__header">/);
});
