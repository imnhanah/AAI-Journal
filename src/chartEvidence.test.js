import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ANNOTATION_COLOR, addAnnotation, annotation, boardObject, boardObjectCanvasGeometry, boardToScreen, commitBoardText, createFittedBoard, defaultStyle, duplicateBoardObjects, fitBoardViewport, history, imageRelativeBoardObject, moveBoardObject, moveImageRelativeBoardObject, normaliseAnnotation, normaliseBoard, normaliseStyle, point, redo, removeAnnotation, replaceAnnotation, resizeBoardImage, screenToBoard, svgPrimitive, undo } from './chartEvidence.js';
import { readFileSync } from 'node:fs';
test('annotations are placement-local and retain relative coordinates',()=>{const a=annotation('box',{x:.1,y:.2},{x:.7,y:.8});const one=addAnnotation({annotations:[]},a);const two=addAnnotation({annotations:[]},annotation('line',{x:0,y:0},{x:1,y:1}));assert.equal(one.annotations[0].start.x,.1);assert.equal(two.annotations.length,1);assert.equal(removeAnnotation(one,a.id).annotations.length,0);});
test('annotation edit and history undo redo preserve originals',()=>{const a=annotation('text',{x:.5,y:.5},{x:.5,y:.5},'note');const first={annotations:[a]};const second=replaceAnnotation(first,a.id,{text:'changed'});assert.equal(first.annotations[0].text,'note');let state={past:[],value:first,future:[]};state=history(state,second);assert.equal(undo(state).value.annotations[0].text,'note');assert.equal(redo(undo(state)).value.annotations[0].text,'changed');});
test('attached evidence exposes a hook-safe board action and the viewer handles absent images',()=>{const editor=readFileSync(new URL('./CaseStudyLibrary.jsx',import.meta.url),'utf8');const viewer=readFileSync(new URL('./ChartViewer.jsx',import.meta.url),'utf8');assert.match(editor,/Open viewer/);assert.match(editor,/openViewer\(item\.id\)/);assert.ok(editor.indexOf("useEffect(() =>") < editor.indexOf('if (viewerId) return <ChartViewerBoundary'));assert.match(editor,/ChartViewerBoundary/);assert.match(viewer,/This evidence image is unavailable/);assert.match(viewer,/onClick=\{leave\}/);});
test('viewer keeps chart image inert while drawings, pan, and history stay available',()=>{const viewer=readFileSync(new URL('./ChartViewer.jsx',import.meta.url),'utf8');assert.match(viewer,/className="cv-board-surface"/);assert.match(viewer,/className="cv-board-objects"/);assert.match(viewer,/draggable="false"/);assert.doesNotMatch(viewer,/kind:'resize'/);assert.match(viewer,/kind:'pan'/);assert.match(viewer,/onPointerCancel=\{up\}/);assert.match(viewer,/Undo2/);assert.match(viewer,/Redo2/);});
test('saved box, arrow, line, text, and freehand records produce visible SVG primitives',()=>{
  const records=[
    [{id:'box',tool:'box',start:{x:10,y:20},end:{x:70,y:80}},'rect'],
    [{id:'arrow',tool:'arrow',start:{x:.1,y:.2},end:{x:.7,y:.8}},'line'],
    [{id:'line',type:'line',x1:10,y1:20,x2:70,y2:80},'line'],
    [{id:'text',type:'text',position:{x:50,y:40},label:'Liquidity'},'text'],
    [{id:'draw',type:'freehand',path:[[10,10],[30,20],[50,50]]},'polyline'],
  ];
  for (const [record,tag] of records) { const primitive=svgPrimitive(record); assert.equal(primitive.tag,tag); if(tag==='rect') assert.ok(primitive.width>0&&primitive.height>0); if(tag==='line') assert.ok(primitive.x1!==primitive.x2&&primitive.y1!==primitive.y2); if(tag==='text') assert.equal(primitive.text,'Liquidity'); if(tag==='polyline') assert.match(primitive.points,/100,100/); }
});
test('legacy percentage geometry normalises without mutating the saved annotation',()=>{
  const saved={id:'legacy',type:'rectangle',x:25,y:40,width:30,height:15}; const display=normaliseAnnotation(saved);
  assert.deepEqual(display.start,{x:.25,y:.4}); assert.deepEqual(display.end,{x:.55,y:.55}); assert.equal(saved.start,undefined);
});
test('pointer positions map to the stable image surface and never to page coordinates',()=>{
  assert.deepEqual(point({clientX:250,clientY:175},{left:100,top:75,width:300,height:200}),{x:.5,y:.5});
  assert.deepEqual(point({clientX:-5,clientY:900},{left:100,top:75,width:300,height:200}),{x:0,y:1});
});
test('board keeps drawing selection and pan separate from the inert chart image',()=>{
  const viewer=readFileSync(new URL('./ChartViewer.jsx',import.meta.url),'utf8');
  assert.match(viewer,/className="cv-board-surface"/); assert.match(viewer,/className="cv-board-world"/); assert.match(viewer,/if\(tool==='pan'\)/); assert.match(viewer,/tool==='select'/); assert.doesNotMatch(viewer,/cv-board-resize/);
});
test('text creation, editing, undo, redo, and reopening retain a visible placement annotation',()=>{
  const created=annotation('text',{x:.3,y:.6},{x:.3,y:.6},'Liquidity sweep');
  const first=addAnnotation({annotations:[]},created); const edited=replaceAnnotation(first,created.id,{text:'Confirmed liquidity sweep'});
  let state=history({past:[],value:first,future:[]},edited);
  assert.equal(svgPrimitive(state.value.annotations[0]).text,'Confirmed liquidity sweep');
  state=undo(state); assert.equal(svgPrimitive(state.value.annotations[0]).text,'Liquidity sweep');
  state=redo(state); const reopened=JSON.parse(JSON.stringify(state.value));
  assert.equal(svgPrimitive(reopened.annotations[0]).text,'Confirmed liquidity sweep');
  assert.equal(svgPrimitive(reopened.annotations[0]).x,300);
});
test('drawing styles are individual, bounded, and survive annotation updates',()=>{
  const line=annotation('line',{x:.1,y:.1},{x:.8,y:.8},'',{thickness:5});
  const arrow=annotation('arrow',{x:.1,y:.1},{x:.8,y:.8},'',{thickness:3,arrowSize:18});
  const box=annotation('box',{x:.1,y:.1},{x:.8,y:.8},'',{thickness:4,fill:'soft'});
  assert.equal(line.style.thickness,5); assert.equal(arrow.style.arrowSize,18); assert.equal(box.style.fill,'soft');
  const changed=replaceAnnotation({annotations:[line]},line.id,{style:{...line.style,thickness:6}});
  assert.equal(changed.annotations[0].style.thickness,6); assert.equal(line.style.thickness,5);
  assert.equal(normaliseAnnotation({tool:'draw'}).style.thickness,2); assert.equal(defaultStyle('text').fontSize,13);
});
test('arrow styles preserve explicit HEX colors and arrowhead sizes through serialization',()=>{
  const arrow=annotation('arrow',{x:.1,y:.1},{x:.8,y:.8},'',{color:'#A14BC9',arrowSize:19});
  const reopened=JSON.parse(JSON.stringify(arrow));
  assert.equal(reopened.style.color,'#A14BC9');
  assert.equal(normaliseStyle('arrow',reopened.style).color,'#A14BC9');
  assert.equal(normaliseStyle('arrow',reopened.style).arrowSize,19);
});
test('annotation colors are explicit HEX values, survive serialization, and never inherit the application theme',()=>{
  const custom=normaliseStyle('line',{color:'#1aB2c3'});
  const legacy=normaliseStyle('line',{color:'accent'});
  const invalid=normaliseStyle('line',{color:'var(--accent)'});
  assert.equal(custom.color,'#1AB2C3');
  assert.equal(legacy.color,DEFAULT_ANNOTATION_COLOR);
  assert.equal(invalid.color,DEFAULT_ANNOTATION_COLOR);
  const blue=boardObject('line',{x:10,y:20},{x:80,y:90},'',{color:'#0077FF'});
  const orange=boardObject('box',{x:20,y:30},{x:70,y:80},'',{color:'#FF6B00'});
  const reopened=JSON.parse(JSON.stringify({objects:[blue,orange]}));
  assert.equal(reopened.objects[0].style.color,'#0077FF');
  assert.equal(reopened.objects[1].style.color,'#FF6B00');
  assert.notEqual(reopened.objects[0].style.color,reopened.objects[1].style.color);
});
test('duplicated annotations retain independent geometry, text, colors, and styles with a small offset',()=>{
  const originals=[
    {...boardObject('line',{x:10,y:20},{x:40,y:60},'',{color:'#0088FF',thickness:4}),relativeToImage:false},
    {...imageRelativeBoardObject('text',{x:120,y:120},{x:120,y:120},{x:100,y:100,width:400,height:200},'Sweep',[],{color:'#FF6600'}),relativeToImage:true},
  ];
  const copies=duplicateBoardObjects(originals);
  assert.equal(copies.length,2); assert.notEqual(copies[0].id,originals[0].id); assert.equal(copies[0].style.color,'#0088FF');
  assert.equal(copies[0].start.x,26); assert.equal(copies[1].text,'Sweep'); assert.equal(copies[1].style.color,'#FF6600');
  assert.ok(copies[1].start.x>originals[1].start.x);
});
test('a multi-delete is one placement history change and undo restores every selected drawing together',()=>{
  const one=boardObject('line',{x:.1,y:.2},{x:.5,y:.7}),two=boardObject('box',{x:.2,y:.3},{x:.6,y:.8}),three=boardObject('ellipse',{x:.3,y:.4},{x:.7,y:.9});
  const before={board:{objects:[one,two,three]}},deleted={board:{objects:[three]}};
  const state=history({past:[],value:before,future:[]},deleted);
  assert.equal(state.past.length,1);
  assert.deepEqual(undo(state).value,before);
  assert.deepEqual(redo(undo(state)).value,deleted);
});
test('style history and reopening preserve selected annotation styles',()=>{
  const box=annotation('box',{x:.1,y:.1},{x:.8,y:.8},'',{thickness:2,fill:'none'});
  const original={annotations:[box]}; const styled=replaceAnnotation(original,box.id,{style:{...box.style,thickness:5,fill:'soft'}});
  let state=history({past:[],value:original,future:[]},styled); assert.equal(state.value.annotations[0].style.fill,'soft');
  state=undo(state); assert.equal(state.value.annotations[0].style.thickness,2);
  state=redo(state); assert.deepEqual(JSON.parse(JSON.stringify(state.value)).annotations[0].style,{...box.style,thickness:5,fill:'soft'});
});
test('resize math preserves aspect ratio, minimum dimensions, placement fields, and history',()=>{
  const source={annotations:[{id:'legacy'}],caption:'Caption',observation:'Observation',richDocument:{type:'doc'},board:{image:{x:10,y:20,width:400,height:225}}};
  const resized={...source,board:{...normaliseBoard(source.board,16/9),image:resizeBoardImage(source.board.image,{x:10,y:20},{x:510,y:20},16/9)}};
  assert.equal(resized.board.image.width,500); assert.equal(resized.board.image.height,281.25); assert.deepEqual(resized.annotations,source.annotations); assert.equal(resized.caption,'Caption'); assert.deepEqual(resized.richDocument,{type:'doc'});
  const minimum=resizeBoardImage(source.board.image,{x:10,y:20},{x:20,y:20},16/9); assert.equal(minimum.width,160); assert.equal(minimum.height,90);
  const atZoomOne=resizeBoardImage(source.board.image,{x:10,y:20},{x:510,y:20},16/9); const atZoomTwo=resizeBoardImage(source.board.image,{x:10,y:20},{x:510,y:20},16/9); assert.deepEqual(atZoomTwo,atZoomOne);
  const state=history({past:[],value:source,future:[]},resized); assert.deepEqual(undo(state).value,source); assert.deepEqual(redo(undo(state)).value,resized);
});
test('in-canvas text creates, edits, moves, cancels empty drafts, and preserves placement data',()=>{
  const source={caption:'Chart caption',annotations:[{id:'legacy'}],richDocument:{type:'doc'},board:{viewport:{zoom:1.25,x:40,y:-20},image:{x:5,y:8,width:400,height:225},objects:[]}};
  const created=commitBoardText(source,{point:{x:220,y:145},text:'Liquidity\nSweep'}); const text=created.board.objects[0];
  assert.equal(text.tool,'text'); assert.equal(text.text,'Liquidity\nSweep'); assert.deepEqual(text.start,{x:220,y:145}); assert.equal(created.caption,'Chart caption'); assert.deepEqual(created.annotations,source.annotations); assert.deepEqual(created.richDocument,source.richDocument);
  const edited=commitBoardText(created,{id:text.id,point:text.start,text:'Confirmed\nSweep'}); assert.equal(edited.board.objects[0].text,'Confirmed\nSweep');
  const moved={...edited,board:{...edited.board,objects:[moveBoardObject(edited.board.objects[0],{x:25,y:-10})]}}; assert.deepEqual(moved.board.objects[0].start,{x:245,y:135});
  assert.strictEqual(commitBoardText(moved,{point:{x:10,y:10},text:'   '}),moved);
  let state=history({past:[],value:source,future:[]},created); state=history(state,edited); state=history(state,moved); assert.equal(undo(state).value.board.objects[0].text,'Confirmed\nSweep'); assert.deepEqual(redo(undo(state)).value.board.objects[0].start,{x:245,y:135});
  assert.equal(JSON.parse(JSON.stringify(moved)).board.objects[0].text,'Confirmed\nSweep');
});
test('board text is isolated by evidence placement and parent study/account data remains untouched',()=>{
  const first={evidencePlacements:{one:{board:{objects:[]}},two:{board:{objects:[]}}},richDocument:{overview:'keep'},body:'legacy'};
  const updated={...first,evidencePlacements:{...first.evidencePlacements,one:commitBoardText(first.evidencePlacements.one,{point:{x:1,y:2},text:'One'})}};
  const otherAccount={study:{evidencePlacements:{one:{board:{objects:[]}}}}};
  assert.equal(updated.evidencePlacements.one.board.objects[0].text,'One'); assert.deepEqual(updated.evidencePlacements.two,first.evidencePlacements.two); assert.deepEqual(updated.richDocument,first.richDocument); assert.equal(updated.body,'legacy'); assert.deepEqual(otherAccount.study.evidencePlacements.one.board.objects,[]);
});
test('viewer renders an in-canvas textarea without browser prompts and protects editor pointer events',()=>{
  const viewer=readFileSync(new URL('./ChartViewer.jsx',import.meta.url),'utf8'); const css=readFileSync(new URL('./chartViewer.css',import.meta.url),'utf8');
  assert.doesNotMatch(viewer,/window\.prompt/); assert.match(viewer,/className="cv-board-text-editor"/); assert.match(viewer,/onDoubleClick=\{doubleClick\}/); assert.match(viewer,/commitBoardText/); assert.match(viewer,/event\.key==='Escape'/); assert.match(viewer,/event\.stopPropagation\(\)/); assert.match(css,/\.cv-board-text-editor/);
});
test('touch text editing has explicit Done and Cancel controls and does not commit on keyboard blur',()=>{
  const viewer=readFileSync(new URL('./ChartViewer.jsx',import.meta.url),'utf8'); const css=readFileSync(new URL('./chartViewer.css',import.meta.url),'utf8');
  assert.match(viewer,/autoFocus/); assert.match(viewer,/aria-label="Edit board text"/); assert.match(viewer,/commitText\(true\).*Cancel/); assert.match(viewer,/commitText\(false\).*Done/); assert.doesNotMatch(viewer,/onBlur=\{\(\)=>commitText\(false\)\}/);
  assert.match(css,/\.cv-board-text-bubble/); assert.match(css,/@media\(max-width:680px\).*\.cv-board-text-bubble button\{min-height:44px/); assert.match(css,/height:100dvh/);
});
test('inline text editor stays compact, autosizes, and keeps its floating controls tied to board coordinates',()=>{
  const viewer=readFileSync(new URL('./ChartViewer.jsx',import.meta.url),'utf8'); const css=readFileSync(new URL('./chartViewer.css',import.meta.url),'utf8');
  assert.match(viewer,/const textEditorWidth=text=>clamp/); assert.match(viewer,/placeholder=\{textEditor\.id\?'':'Type text'\}/); assert.match(viewer,/input\.style\.height='0px'/); assert.match(viewer,/textEditor\.point\.y\*board\.viewport\.zoom\+board\.viewport\.y<84/);
  assert.match(css,/\.cv-board-text-editor \{[^}]*min-height:34px/); assert.match(css,/\.cv-board-text-bubble \{[^}]*bottom:calc\(100% \+ 6px\)/); assert.match(css,/\.cv-board-text-editor-wrap\.is-near-top/); assert.doesNotMatch(css,/\.cv-board-text-editor \{[^}]*min-height:88px/);
});
test('board save status is parent-confirmed and text draft recovery is scoped to its placement',()=>{
  const library=readFileSync(new URL('./CaseStudyLibrary.jsx',import.meta.url),'utf8'); const viewer=readFileSync(new URL('./ChartViewer.jsx',import.meta.url),'utf8');
  assert.match(library,/const saveVersion = useRef\(0\)/); assert.match(library,/if \(saveVersion\.current===version\) setSaveState\('Saved'\)/); assert.match(library,/setSaveState\('Save failed'\)/); assert.match(library,/const retrySave/); assert.match(viewer,/aria-live="polite">\{saveState\}/); assert.match(viewer,/Retry save/); assert.match(viewer,/studyId:study\?\.id,evidenceId:activeId,accountId/); assert.match(viewer,/sessionStorage\.setItem/); assert.match(viewer,/save\(next,editor\.evidenceId\)/); assert.match(viewer,/Recovered unsaved text draft for this placement/); assert.match(viewer,/const leave=\(\)=>\{commitText\(false\);onBack\(\);\}/);
});
test('world/screen conversion is reversible for positive and negative board objects',()=>{
  const viewport={zoom:1.25,x:80,y:-35};
  for (const world of [{x:240,y:180},{x:-160,y:-90},{x:2600,y:1900}]) assert.deepEqual(screenToBoard(boardToScreen(world,viewport),viewport),world);
  const viewer=readFileSync(new URL('./ChartViewer.jsx',import.meta.url),'utf8'); const css=readFileSync(new URL('./chartViewer.css',import.meta.url),'utf8');
  assert.match(viewer,/screenToBoard\(\{x:event\.clientX-rect\.left,y:event\.clientY-rect\.top\},board\.viewport\)/); assert.match(css,/\.cv-board-objects \{ height:1px; left:0; top:0; width:1px; \}/);
});
test('a new board fits the loaded image in the measured canvas without persisting a default viewport',()=>{
  const board=createFittedBoard({width:390,height:620},2400,1200);
  assert.equal(board.objects.length,0); assert.equal(board.viewport.zoom,1);
  assert.ok(board.image.x>=0&&board.image.y>=0); assert.ok(board.image.x+board.image.width<=390); assert.ok(board.image.y+board.image.height<=620);
  assert.equal(board.image.width/board.image.height,2);
});
test('Fit view preserves board geometry and objects through a later edit, save, and reopen',()=>{
  const saved={caption:'Keep this',board:{viewport:{zoom:1.25,x:-1600,y:900},image:{x:1300,y:-700,width:800,height:450},objects:[boardObject('text',{x:1480,y:-500},{x:1480,y:-500},'Liquidity'),boardObject('line',{x:1380,y:-600},{x:1900,y:-300})]}};
  const fitted=fitBoardViewport(saved.board,{width:390,height:620});
  assert.deepEqual(fitted.image,normaliseBoard(saved.board).image); assert.deepEqual(fitted.objects,normaliseBoard(saved.board).objects);
  assert.notDeepEqual(fitted.viewport,normaliseBoard(saved.board).viewport);
  const edited={...saved,board:{...fitted,objects:[...fitted.objects,boardObject('text',{x:1600,y:-350},{x:1600,y:-350},'Saved after Fit')]}};
  const reopened=JSON.parse(JSON.stringify(edited));
  assert.equal(reopened.caption,'Keep this'); assert.equal(reopened.board.objects.length,3);
  assert.equal(reopened.board.objects[0].text,'Liquidity'); assert.deepEqual(reopened.board.image,saved.board.image);
});
test('Fit view centers a saved offscreen chart without moving its image or annotations',()=>{
  const board={viewport:{zoom:1,x:0,y:0},image:{x:2000,y:1800,width:760,height:427.5},objects:[boardObject('text',{x:2050,y:1850},{x:2050,y:1850},'Note')]};
  const fitted=fitBoardViewport(board,{width:430,height:700});
  const corner=boardToScreen({x:board.image.x,y:board.image.y},fitted.viewport);
  assert.ok(corner.x>=0&&corner.y>=0); assert.deepEqual(fitted.image,normaliseBoard(board).image); assert.deepEqual(fitted.objects,normaliseBoard(board).objects);
});
test('viewer distinguishes loading and failure states, retries images, and guards placement switching',()=>{
  const viewer=readFileSync(new URL('./ChartViewer.jsx',import.meta.url),'utf8'); const css=readFileSync(new URL('./chartViewer.css',import.meta.url),'utf8');
  assert.match(viewer,/onLoad=\{loadImage\}/); assert.match(viewer,/onError=\{failImage\}/); assert.match(viewer,/Retry image/); assert.match(viewer,/event\.currentTarget\.dataset\.imageKey!==imageKeyRef\.current/); assert.match(viewer,/key=\{`\$\{imageKey\}:\$\{activeImageState\.retry\}`\}/);
  assert.match(viewer,/createFittedBoard\(size,image\.naturalWidth,image\.naturalHeight\)/); assert.match(viewer,/fitBoardViewport\(normaliseBoard\(current\.board,ratio\),size\)/); assert.match(css,/\.cv-board-image-status/);
});
test('board workspace uses connected flex chrome and a canvas that owns remaining height',()=>{
  const viewer=readFileSync(new URL('./ChartViewer.jsx',import.meta.url),'utf8'); const css=readFileSync(new URL('./chartViewer.css',import.meta.url),'utf8');
  assert.match(viewer,/className="cv-board-chrome"/); assert.match(viewer,/Fit view/); assert.match(css,/\.cv\.cv-board\{[^}]*background:var\(--raised\)[^}]*display:flex[^}]*flex-direction:column/); assert.match(css,/\.cv-board-chrome\{[^}]*flex:0 0 auto[^}]*width:100%/); assert.match(css,/\.cv-board-surface\{background-color:var\(--raised\).*flex:1 1 0.*min-height:0.*min-width:0.*width:100%/); assert.match(css,/\.cv-board-world\{height:1px;left:0;position:absolute;top:0/); assert.doesNotMatch(css,/\.cv-board-surface\{[^}]*top:105px/);
});

test('viewer is the full-width flex child while its bounded inspector remains beside the chart',()=>{
  const css=readFileSync(new URL('./chartViewer.css',import.meta.url),'utf8');
  assert.match(css,/\.cv\.cv-board\{[^}]*flex:1 1 0[^}]*max-width:none[^}]*min-width:0[^}]*width:100%/);
  assert.match(css,/\.cv-board-workspace \{[^}]*grid-template-columns:152px minmax\(0,1fr\) clamp\(250px,22vw,310px\)[^}]*overflow:hidden/);
  assert.match(css,/\.cv-board-workspace > \.cv-board-tools \{[^}]*grid-column:1[^}]*overflow-x:hidden[^}]*overflow-y:auto[^}]*width:152px/);
  assert.match(css,/\.cv-board-workspace > \.cv-board-surface \{ grid-column:2; grid-row:1/);
});

test('image load fits either a new or existing board once without changing image-relative annotations',()=>{
  const viewer=readFileSync(new URL('./ChartViewer.jsx',import.meta.url),'utf8');
  assert.match(viewer,/current\.board\?fitBoardViewport\(normaliseBoard\(current\.board,imageRatio\),size\):createFittedBoard/);
  assert.match(viewer,/initialisedBoardKeyRef\.current===imageKey/);
  assert.match(viewer,/data-image-key=\{imageKey\}/);
  assert.match(viewer,/setImageState\(state=>\(\{key:imageKey,status:'loaded'/);
  assert.match(viewer,/\[panelOpen,compareOpen,activeImageState\.status\]/);
});

test('new board objects retain image-relative geometry through image movement, resizing, and reopen serialization',()=>{
  const image={x:100,y:80,width:800,height:400};
  const line=imageRelativeBoardObject('line',{x:180,y:120},{x:740,y:360},image);
  assert.equal(line.relativeToImage,true);
  assert.deepEqual(boardObjectCanvasGeometry(line,image).start,{x:180,y:120});
  const movedImage={x:260,y:40,width:1200,height:600};
  assert.deepEqual(boardObjectCanvasGeometry(JSON.parse(JSON.stringify(line)),movedImage).start,{x:380,y:100});
  const shifted=moveImageRelativeBoardObject(line,{x:120,y:60},image);
  assert.deepEqual(boardObjectCanvasGeometry(shifted,image).start,{x:300,y:180});
});

test('Phase 5 viewer has cancellation, compare, inspector, and image-relative rendering paths',()=>{
  const viewer=readFileSync(new URL('./ChartViewer.jsx',import.meta.url),'utf8'); const library=readFileSync(new URL('./CaseStudyLibrary.jsx',import.meta.url),'utf8'); const css=readFileSync(new URL('./chartViewer.css',import.meta.url),'utf8');
  assert.match(viewer,/onContextMenu=\{event=>\{event\.preventDefault\(\);setDraft\(null\);setMoving\(null\);setTool\('select'\);\}\}/);
  assert.match(viewer,/event\.key==='Escape'/);
  assert.match(viewer,/imageRelativeBoardObject\(draft\.tool/);
  assert.match(viewer,/boardObjectCanvasGeometry\(object,board\.image\)/);
  assert.match(viewer,/Compare evidence/);
  assert.match(viewer,/cv-inspector-properties/);
  assert.match(library,/allEvidence=\{workspace\.evidence\}/);
  assert.match(css,/\.cv-board-workspace\.is-comparing/);
  assert.match(css,/\.cv-board-bottom/);
});

test('viewer uses the native color input and carries the selected color into new drawing and text records',()=>{
  const viewer=readFileSync(new URL('./ChartViewer.jsx',import.meta.url),'utf8');
  const css=readFileSync(new URL('./chartViewer.css',import.meta.url),'utf8');
  assert.match(viewer,/type="color" aria-label="Annotation color"/);
  assert.match(viewer,/setDrawingColor\(color\)/);
  assert.match(viewer,/style:\{color:drawingColor\}/);
  assert.match(viewer,/imageRelativeBoardObject\(draft\.tool,[\s\S]*draft\.style\)/);
  assert.match(viewer,/const markerId=key=>`board-arrow-/);
  assert.match(viewer,/fill=\{color\} stroke=\{color\}/);
  assert.match(viewer,/markerEnd=\{item\.tool==='arrow'\?`url\(#\$\{markerId\(key\)\}\)`/);
  assert.doesNotMatch(viewer,/context-stroke/);
  assert.match(css,/\.cv-inspector \.cv-color-field input\[type="color"\]/);
});

test('viewer selection shortcuts are placement-local, atomic, and leave editable fields alone',()=>{
  const viewer=readFileSync(new URL('./ChartViewer.jsx',import.meta.url),'utf8');
  assert.match(viewer,/\[selectedIds,setSelectedIds\]=useState\(\[\]\)/);
  assert.match(viewer,/event\.shiftKey\)\{toggleSelection\(object\.id\);return;\}/);
  assert.match(viewer,/command&&key==='a'/);
  assert.match(viewer,/command&&key==='z'/);
  assert.match(viewer,/command&&key==='c'/);
  assert.match(viewer,/command&&key==='v'/);
  assert.match(viewer,/command&&key==='d'/);
  assert.match(viewer,/target\?\.closest\?\.\(/);
  assert.match(viewer,/contenteditable="true"/);
  assert.match(viewer,/const deleteSelection=.*new Set\(selectedIds\)[\s\S]*objects\.filter\(object=>!ids\.has\(object\.id\)\)/);
  assert.match(viewer,/copiedObjectsRef\.current=\[\]/);
});
