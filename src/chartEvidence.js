const clamp = value => Math.max(0, Math.min(1, value));

// Early saves used percentage geometry. New saves use unit geometry, but this
// read-only conversion keeps old placement data visible without migrating it.
const unit = (value, fallback = 0) => {
  if (typeof value === 'string') value = Number.parseFloat(value);
  if (!Number.isFinite(value)) return fallback;
  return clamp(Math.abs(value) > 1 ? value / 100 : value);
};
const coordinate = (value, fallback = {}) => ({
  x:unit(value?.x ?? value?.left ?? value?.x1, fallback.x ?? 0),
  y:unit(value?.y ?? value?.top ?? value?.y1, fallback.y ?? 0),
});
const toolName = value => ({ rectangle:'box', rect:'box', freehand:'draw', pen:'draw' }[value] || value || 'line');
const number = (value, fallback, min, max) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
};
export const DEFAULT_ANNOTATION_COLOR = '#B89AFF';
// Desktop viewer swatches (stored on each annotation, so they are data colours, not theme colours).
export const ANNOTATION_SWATCHES = Object.freeze(['#B89AFF', '#FBBF24', '#F87171', '#2FD6A0']);
export const normaliseAnnotationColor = value => {
  const source=String(value || '').trim();
  const short=source.match(/^#([\da-f])([\da-f])([\da-f])$/i);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toUpperCase();
  return /^#[\da-f]{6}$/i.test(source) ? source.toUpperCase() : DEFAULT_ANNOTATION_COLOR;
};
export const defaultStyle = tool => ({
  thickness:2,
  arrowSize:10,
  fill:'none',
  fontSize:13,
  color:DEFAULT_ANNOTATION_COLOR,
  ...(tool === 'text' ? { thickness:0 } : {}),
});
export const normaliseStyle = (tool, value = {}) => ({
  ...defaultStyle(tool),
  ...(value && typeof value === 'object' ? value : {}),
  thickness:number(value?.thickness, defaultStyle(tool).thickness, 1, 6),
  arrowSize:number(value?.arrowSize, 10, 6, 24),
  fontSize:number(value?.fontSize, 13, 10, 24),
  fill:['none','transparent','soft'].includes(value?.fill) ? value.fill : 'none',
  color:normaliseAnnotationColor(value?.color),
});

export const normaliseAnnotation = (value = {}) => {
  const tool = toolName(value.tool || value.type || value.kind);
  const start = coordinate(value.start || value.from || value.position || value, { x:value.x1, y:value.y1 });
  const width = unit(value.width, 0);
  const height = unit(value.height, 0);
  const end = coordinate(value.end || value.to || { x:value.x2 ?? start.x + width, y:value.y2 ?? start.y + height }, start);
  const points = (Array.isArray(value.points) ? value.points : Array.isArray(value.path) ? value.path : [])
    .map(entry => Array.isArray(entry) ? { x:unit(entry[0]), y:unit(entry[1]) } : coordinate(entry))
    .filter(entry => Number.isFinite(entry.x) && Number.isFinite(entry.y));
  return { ...value, tool, start, end, text:String(value.text ?? value.label ?? ''), points, style:normaliseStyle(tool, value.style) };
};

// Keeping this pure makes the data-to-SVG path testable without a browser.
// Coordinates are expanded into a 1000-unit SVG square, where every valid
// normalized annotation has a visible, positive geometry.
export const svgPrimitive = value => {
  const item = normaliseAnnotation(value); const x1 = item.start.x * 1000; const y1 = item.start.y * 1000; const x2 = item.end.x * 1000; const y2 = item.end.y * 1000;
  if (item.tool === 'box') return { item, tag:'rect', x:Math.min(x1,x2), y:Math.min(y1,y2), width:Math.abs(x2-x1), height:Math.abs(y2-y1) };
  if (item.tool === 'text') return { item, tag:'text', x:x1, y:y1, text:item.text || 'Text' };
  if (item.tool === 'draw') return { item, tag:'polyline', points:item.points.map(point => `${point.x * 1000},${point.y * 1000}`).join(' ') };
  return { item, tag:'line', x1, y1, x2, y2, arrow:item.tool === 'arrow' };
};

export const viewport = (value = {}) => ({ zoom:Number(value.zoom) || 1, panX:Number(value.panX) || 0, panY:Number(value.panY) || 0 });
export const annotation = (tool, start, end = start, text = '', style = {}) => ({ id:globalThis.crypto?.randomUUID?.() || `annotation-${Date.now()}-${Math.random()}`, tool, start, end, text, style:normaliseStyle(tool, style), points:tool === 'draw' ? [start,end] : undefined });
export const point = (event, rect) => ({ x:clamp((event.clientX-rect.left)/Math.max(rect.width, 1)), y:clamp((event.clientY-rect.top)/Math.max(rect.height, 1)) });
export const addAnnotation = (placement, item) => ({ ...placement, annotations:[...(placement.annotations || []),item], revision:(placement.revision || 0)+1 });
export const replaceAnnotation = (placement, id, patch) => ({ ...placement, annotations:(placement.annotations || []).map(item=>item.id===id?{...item,...patch}:item), revision:(placement.revision || 0)+1 });
export const removeAnnotation = (placement,id) => ({ ...placement, annotations:(placement.annotations || []).filter(item=>item.id!==id), revision:(placement.revision || 0)+1 });
export const history = (state, next) => ({ past:[...(state.past||[]),state.value], value:next, future:[] });
export const undo = state => !state.past?.length ? state : ({ past:state.past.slice(0,-1), value:state.past.at(-1), future:[state.value,...(state.future||[])] });
export const redo = state => !state.future?.length ? state : ({ past:[...(state.past||[]),state.value], value:state.future[0], future:state.future.slice(1) });
export const moveAnnotation = (placement, id, offset) => {
  const item = placement.annotations?.find(entry => entry.id === id);
  if (!item) return placement;
  const geometry = normaliseAnnotation(item);
  const shift = value => ({ x:clamp(value.x + offset.x), y:clamp(value.y + offset.y) });
  return replaceAnnotation(placement, id, { start:shift(geometry.start), end:shift(geometry.end), points:geometry.points.map(shift) });
};

export const BOARD_VERSION = 1;
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
export const boardToScreen = (value, viewport = {}) => ({ x:value.x * finite(viewport.zoom,1) + finite(viewport.x,0), y:value.y * finite(viewport.zoom,1) + finite(viewport.y,0) });
export const screenToBoard = (value, viewport = {}) => { const zoom=Math.max(.25,finite(viewport.zoom,1)); return { x:(value.x-finite(viewport.x,0))/zoom, y:(value.y-finite(viewport.y,0))/zoom }; };
export const normaliseBoard = (value = {}, ratio = 16 / 9) => ({
  version:BOARD_VERSION,
  viewport:{zoom:Math.max(.25,Math.min(3,finite(value.viewport?.zoom,1))),x:finite(value.viewport?.x,0),y:finite(value.viewport?.y,0)},
  image:{x:finite(value.image?.x,0),y:finite(value.image?.y,0),width:Math.max(160,finite(value.image?.width,760)),height:Math.max(90,finite(value.image?.height,760/ratio))},
  objects:Array.isArray(value.objects)?value.objects.filter(item=>item&&typeof item==='object'):[],
});
const boardSize = surface => ({
  width:Math.max(1,finite(surface?.width,1)),
  height:Math.max(1,finite(surface?.height,1)),
});
// This creates a board only for an evidence placement that has never had one.
// Existing board geometry is deliberately not passed through this helper.
export const createFittedBoard = (surface, naturalWidth, naturalHeight) => {
  const area=boardSize(surface), ratio=Math.max(.1,finite(naturalWidth,16)/Math.max(1,finite(naturalHeight,9)));
  const padding=Math.min(24,Math.max(8,Math.min(area.width,area.height)*.06));
  const width=Math.max(1,area.width-padding*2), height=Math.max(1,area.height-padding*2);
  const imageWidth=Math.max(1,Math.min(width,height*ratio)), imageHeight=imageWidth/ratio;
  return {version:BOARD_VERSION,viewport:{zoom:1,x:0,y:0},image:{x:(area.width-imageWidth)/2,y:(area.height-imageHeight)/2,width:imageWidth,height:imageHeight},objects:[]};
};
// Fit is intentionally viewport-only: it never changes image geometry or board
// objects, so using Fit before a later save cannot discard annotations or text.
export const fitBoardViewport = (value, surface) => {
  const board=normaliseBoard(value), area=boardSize(surface), padding=Math.min(24,Math.max(8,Math.min(area.width,area.height)*.06));
  const availableWidth=Math.max(1,area.width-padding*2), availableHeight=Math.max(1,area.height-padding*2);
  const zoom=Math.max(.25,Math.min(3,Math.min(availableWidth/board.image.width,availableHeight/board.image.height)));
  return {...board,viewport:{zoom,x:(area.width-board.image.width*zoom)/2-board.image.x*zoom,y:(area.height-board.image.height*zoom)/2-board.image.y*zoom}};
};
export const patchBoard = (placement, patch) => ({...placement,board:{...placement.board,...patch}});
export const boardObject = (tool, start, end=start, text='', style={}) => ({id:globalThis.crypto?.randomUUID?.()||`board-${Date.now()}-${Math.random()}`,tool,start,end,text,style:normaliseStyle(tool==='pen'?'draw':tool,style)});
export const commitBoardText = (placement, draft) => {
  const board=normaliseBoard(placement?.board); const text=String(draft?.text ?? '').trim();
  if (!text && !draft?.id) return placement;
  const objects=!text ? board.objects.filter(item=>item.id!==draft.id) : draft.id
    ? board.objects.map(item=>item.id===draft.id?{...item,text}:item)
    : [...board.objects,boardObject('text',draft.point,draft.point,text)];
  return {...placement,board:{...board,objects}};
};
export const resizeBoardImage = (image, start, point, ratio) => {
  const width=Math.max(160,Math.abs(point.x-start.x)); const height=Math.max(90,width/Math.max(ratio,.1));
  return {...image,width,height};
};
export const moveBoardObject = (object, offset) => ({...object,start:{x:object.start.x+offset.x,y:object.start.y+offset.y},end:{x:object.end.x+offset.x,y:object.end.y+offset.y},points:object.points?.map(point=>({x:point.x+offset.x,y:point.y+offset.y}))});

const copiedBoardId = () => globalThis.crypto?.randomUUID?.() || `board-copy-${Date.now()}-${Math.random().toString(16).slice(2)}`;
// Copies are deliberately placement-local. Relative records receive a small
// image-relative nudge; older absolute records receive the same visible nudge
// in canvas pixels without changing their original record.
export const duplicateBoardObjects = (objects = [], relativeOffset = .02, canvasOffset = 16) => objects.map(object => {
  const offset=object?.relativeToImage ? relativeOffset : canvasOffset;
  const movePoint=point=>object?.relativeToImage
    ? {x:clamp(Number(point?.x || 0)+offset),y:clamp(Number(point?.y || 0)+offset)}
    : {x:Number(point?.x || 0)+offset,y:Number(point?.y || 0)+offset};
  return {...object,id:copiedBoardId(),start:movePoint(object?.start),end:movePoint(object?.end),points:object?.points?.map(movePoint),style:object?.style?{...object.style}:object?.style};
});

// New viewer objects are stored in image-relative coordinates. Legacy boards
// retain their absolute canvas geometry and are rendered unchanged.
export const imageRelativePoint = (point, image) => ({
  x:clamp((Number(point?.x) - Number(image?.x || 0)) / Math.max(1, Number(image?.width || 1))),
  y:clamp((Number(point?.y) - Number(image?.y || 0)) / Math.max(1, Number(image?.height || 1))),
});
export const imageCanvasPoint = (point, image) => ({
  x:Number(image?.x || 0) + Number(point?.x || 0) * Math.max(1, Number(image?.width || 1)),
  y:Number(image?.y || 0) + Number(point?.y || 0) * Math.max(1, Number(image?.height || 1)),
});
export const imageRelativeBoardObject = (tool, start, end, image, text = '', points = [], style = {}) => ({
  ...boardObject(tool, imageRelativePoint(start,image), imageRelativePoint(end,image), text, style),
  relativeToImage:true,
  points:tool === 'pen' ? points.map(point=>imageRelativePoint(point,image)) : undefined,
});
export const boardObjectCanvasGeometry = (object, image) => {
  if (!object?.relativeToImage) return object;
  return {
    ...object,
    start:imageCanvasPoint(object.start,image),
    end:imageCanvasPoint(object.end,image),
    points:(object.points || []).map(point=>imageCanvasPoint(point,image)),
  };
};
export const moveImageRelativeBoardObject = (object, canvasOffset, image) => {
  if (!object?.relativeToImage) return moveBoardObject(object,canvasOffset);
  const offset={x:Number(canvasOffset?.x || 0)/Math.max(1,Number(image?.width || 1)),y:Number(canvasOffset?.y || 0)/Math.max(1,Number(image?.height || 1))};
  const shift=point=>({x:clamp(point.x+offset.x),y:clamp(point.y+offset.y)});
  return {...object,start:shift(object.start),end:shift(object.end),points:object.points?.map(shift)};
};
