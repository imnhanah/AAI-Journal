import { NodeViewWrapper } from '@tiptap/react';
import { useRef, useState } from 'react';
import { validCaseStudyObject } from './caseStudyV8Objects.js';

function Shape({ kind }) {
  return <svg viewBox="0 0 180 120" aria-label={kind + ' shape'}>
    <g fill="none" stroke="currentColor" strokeWidth="3">
      {kind === 'arrow' && <path d="M15 60H155m-30-25 30 25-30 25"/>}
      {kind === 'rect' && <rect x="18" y="20" width="135" height="75" rx="8"/>}
      {kind === 'circle' && <circle cx="90" cy="60" r="43"/>}
      {kind === 'line' && <path d="m15 95 145-70"/>}
    </g>
  </svg>;
}

function Chart({ kind, values }) {
  const max = Math.max(...values, 1);
  const total = values.reduce((sum, value) => sum + value, 0) || 1;
  let angle = 0;
  return <svg viewBox="0 0 300 180" aria-label={kind + ' chart'}>
    {kind === 'bar' && values.map((value, index) => <rect key={index} x={15 + index * 270 / values.length}
      y={155 - value / max * 130} width={Math.max(1, 220 / values.length)} height={value / max * 130} fill="currentColor"/>)}
    {kind === 'line' && <polyline points={values.map((value, index) =>
      [20 + index * 260 / Math.max(1, values.length - 1), 155 - value / max * 130].join(',')).join(' ')} fill="none" stroke="currentColor" strokeWidth="3"/>}
    {kind === 'pie' && values.map((value, index) => {
      const start = angle;
      const size = value / total * Math.PI * 2;
      angle += size;
      if (!size) return null;
      if (size >= Math.PI * 2) return <circle key={index} cx="150" cy="90" r="75" fill="currentColor"/>;
      const a = [150 + 75 * Math.cos(start), 90 + 75 * Math.sin(start)];
      const b = [150 + 75 * Math.cos(angle), 90 + 75 * Math.sin(angle)];
      return <path key={index} d={`M150 90L${a}A75 75 0 ${size > Math.PI ? 1 : 0} 1 ${b}Z`}
        fill="currentColor" opacity={0.35 + 0.65 * (index + 1) / values.length}/>;
    })}
  </svg>;
}

function Drawing({ strokes }) {
  return <svg viewBox="0 0 1000 600" aria-label="Research drawing">
    {strokes.map((stroke, index) => <polyline key={index} points={stroke.points.map(point => point.join(',')).join(' ')}
      fill="none" stroke={stroke.color} strokeWidth={stroke.width} strokeLinecap="round" strokeLinejoin="round"/>)}
  </svg>;
}

export function CaseStudyObjectView({ node, editor, selected, updateAttributes, getPos }) {
  const { kind, shape, chart, values, text, strokes, width, align, rotation, flipX, flipY, wrap } = node.attrs;
  const select = () => {
    const position = getPos();
    if (typeof position === 'number') editor.commands.setNodeSelection(position);
  };
  return <NodeViewWrapper className={`rde-v8-object rde-image--${align}${wrap ? ' is-wrapped' : ''}${selected ? ' is-selected' : ''}`}
    style={{ width:`${Math.max(25, Math.min(100, width))}%` }} contentEditable={false} data-drag-handle onClick={select}
    onDoubleClick={() => { if (editor.isEditable && kind !== 'textBox') editor.options.caseStudyObjectEdit?.({ ...node.attrs, position:getPos() }); }}>
    <div className="rde-v8-object-body" style={{ transform:`rotate(${rotation}deg) scale(${flipX ? -1 : 1}, ${flipY ? -1 : 1})` }}>
      {kind === 'shape' && <Shape kind={shape}/>}
      {kind === 'chart' && <Chart kind={chart} values={values}/>}
      {kind === 'drawing' && <Drawing strokes={strokes}/>}
      {kind === 'textBox' && <textarea aria-label="Text box" value={text} readOnly={!editor.isEditable}
        onChange={event => updateAttributes({ text:event.target.value })}/>}
    </div>
    {selected && editor.isEditable && <div className="rde-v8-object-tools">
      <label>Size<input aria-label="Object size" type="range" min="25" max="100" value={width}
        onChange={event => updateAttributes({ width:Number(event.target.value) })}/></label>
      {kind !== 'textBox' && <button type="button" onClick={() => editor.options.caseStudyObjectEdit?.({ ...node.attrs, position:getPos() })}>Edit {kind}</button>}
      <button type="button" onClick={() => updateAttributes({ rotation:(rotation + 90) % 360 })}>Rotate</button>
      <button type="button" aria-pressed={flipX} onClick={() => updateAttributes({ flipX:!flipX })}>Flip</button>
      <button type="button" aria-pressed={wrap} onClick={() => updateAttributes({ wrap:!wrap, align:align === 'center' ? 'left' : align })}>Wrap text</button>
      <button type="button" onClick={() => { select(); editor.commands.deleteSelection(); }}>Remove object</button>
    </div>}
  </NodeViewWrapper>;
}

function DrawingInput({ strokes, onChange }) {
  const active = useRef(null);
  const [tool, setTool] = useState('pen');
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const [color, setColor] = useState(() => {
    const accent=getComputedStyle(document.documentElement).getPropertyValue('--accent');
    const components=accent.match(/\d+/g);
    if(/^#[a-f0-9]{6}$/i.test(accent.trim()))return accent.trim();
    return '#'+(components?.slice(0,3)||[41,132,89]).map(value=>Number(value).toString(16).padStart(2,'0')).join('');
  });
  const [width, setWidth] = useState(5);
  const position = event => {
    const rect = event.currentTarget.getBoundingClientRect();
    return [Math.max(0, Math.min(1000, (event.clientX - rect.left) / rect.width * 1000)),
      Math.max(0, Math.min(600, (event.clientY - rect.top) / rect.height * 600))];
  };
  const erase = (current, point) => current.filter(stroke => !stroke.points.some((end, index) => {
    const start=stroke.points[index-1]||end;
    const dx=end[0]-start[0],dy=end[1]-start[1];
    const distance=dx*dx+dy*dy;
    const fraction=distance ? Math.max(0,Math.min(1,((point[0]-start[0])*dx+(point[1]-start[1])*dy)/distance)) : 0;
    return Math.hypot(point[0]-start[0]-fraction*dx,point[1]-start[1]-fraction*dy)<Math.max(18,stroke.width+8);
  }));
  const finish = () => { active.current = null; };
  return <>
    <div className="rde-v8-drawing-tools">
      <button type="button" aria-pressed={tool==='pen'} onClick={()=>setTool('pen')}>Pen</button>
      <button type="button" aria-pressed={tool==='eraser'} onClick={()=>setTool('eraser')}>Eraser</button>
      <input type="color" aria-label="Pen color" value={color} onChange={event => setColor(event.target.value)}/>
      <label>Pen width<input type="range" min="1" max="20" value={width} onChange={event => setWidth(Number(event.target.value))}/></label>
      <button type="button" disabled={!past.length} onClick={() => {
        setFuture([strokes,...future]);onChange(past.at(-1));setPast(past.slice(0,-1));
      }}>Undo drawing</button>
      <button type="button" disabled={!future.length} onClick={() => {
        setPast([...past,strokes]);onChange(future[0]);setFuture(future.slice(1));
      }}>Redo drawing</button>
    </div>
    <div className="rde-v8-drawing-input" onPointerDown={event => {
      if (event.button !== 0 || !event.isPrimary) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      setPast([...past,strokes]);setFuture([]);
      const point=position(event);
      const stroke = { color, width, points:[point] };
      const next=tool==='eraser'?erase(strokes,point):[...strokes,stroke];
      active.current = { pointer:event.pointerId, stroke, base:strokes, current:next };
      onChange(next);
    }} onPointerMove={event => {
      const drawing=active.current;
      if (drawing?.pointer !== event.pointerId) return;
      const point=position(event);
      if(tool==='eraser'){
        drawing.current=erase(drawing.current,point);onChange(drawing.current);return;
      }
      drawing.stroke = { ...drawing.stroke, points:[...drawing.stroke.points, point] };
      drawing.current=[...drawing.base,drawing.stroke];
      onChange(drawing.current);
    }} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}>
      <Drawing strokes={strokes}/>
    </div>
  </>;
}

export function CaseStudyObjectComposer({ initial, Dialog, onClose, onSave }) {
  const [fields, setFields] = useState({ shape:'arrow', chart:'bar', values:[40, 70, 55], strokes:[], text:'', width:60,
    align:'center', rotation:0, flipX:false, flipY:false, wrap:false, ...initial });
  const [numbers, setNumbers] = useState(fields.values.join(', '));
  const [error, setError] = useState('');
  return <Dialog title={`${initial.position == null ? 'Insert' : 'Edit'} ${fields.kind}`} onClose={onClose}>
    <form className="rde-v8-form" onSubmit={event => {
      event.preventDefault();
      const result = { ...fields, values:numbers.split(',').map(value => Number(value.trim())) };
      delete result.position;
      if (!validCaseStudyObject(result)) return setError('Check the values. Use up to 30 non-negative numbers.');
      onSave(result);
    }}>
      {fields.kind === 'shape' && <label>Shape<select value={fields.shape} onChange={event => setFields({ ...fields, shape:event.target.value })}>
        {['arrow', 'rect', 'circle', 'line'].map(value => <option key={value} value={value}>{value}</option>)}
      </select><Shape kind={fields.shape}/></label>}
      {fields.kind === 'chart' && <>
        <label>Chart type<select value={fields.chart} onChange={event => setFields({ ...fields, chart:event.target.value })}>
          {['bar', 'line', 'pie'].map(value => <option key={value} value={value}>{value}</option>)}
        </select></label><label>Values<input value={numbers} onChange={event => setNumbers(event.target.value)}/></label>
      </>}
      {fields.kind === 'drawing' && <DrawingInput strokes={fields.strokes} onChange={strokes => setFields({ ...fields, strokes })}/>}
      {fields.kind === 'textBox' && <label>Text<textarea value={fields.text} onChange={event => setFields({ ...fields, text:event.target.value })}/></label>}
      {error && <p role="alert">{error}</p>}
      <footer><button type="button" onClick={onClose}>Cancel</button><button className="rde-v8-primary">Save object</button></footer>
    </form>
  </Dialog>;
}
