import {CaseStudyObjectComposer} from './CaseStudyV8Objects.jsx';
import { useEffect, useId, useRef, useState } from 'react';
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, ImagePlus, Italic, Link2, List, ListChecks, ListOrdered, Minus, Redo2, RemoveFormatting, Strikethrough, Table2, Underline, Undo2 } from 'lucide-react';
import { CASE_STUDY_TABLE_STYLES } from './caseStudyRichFormat.js';
import { isSafeLink } from './studyRichDocument.js';

export function CaseStudyEditorDialog({ title, children, onClose }) {
  const dialogRef = useRef(null);
  const label = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    const viewport=window.visualViewport;
    const place=()=>{
      const width=viewport?.width||window.innerWidth,height=viewport?.height||window.innerHeight;
      dialog.style.left=((viewport?.offsetLeft||0)+width/2)+'px';
      dialog.style.top=((viewport?.offsetTop||0)+height/2)+'px';
      dialog.style.maxWidth=Math.max(0,width-24)+'px';
      dialog.style.maxHeight=Math.max(0,height-24)+'px';
    };
    place();
    dialog.showModal();
    viewport?.addEventListener('resize',place);
    viewport?.addEventListener('scroll',place);
    window.addEventListener('resize',place);
    return () => {
      viewport?.removeEventListener('resize',place);
      viewport?.removeEventListener('scroll',place);
      window.removeEventListener('resize',place);
      dialog.close();
    };
  }, []);
  return <dialog ref={dialogRef} className="rde-v8-dialog" aria-labelledby={label}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="rde-v8-dialog-body">
      <h2 id={label}>{title}</h2>
      {children}
    </div>
  </dialog>;
}

function LinkEditor({ editor, selection, onClose }) {
  const { from, to } = selection;
  const previous = editor.getAttributes('link').href || '';
  const [href, setHref] = useState(previous);
  const [label, setLabel] = useState(editor.state.doc.textBetween(from, to, ' '));
  const [error, setError] = useState('');
  const save = event => {
    event.preventDefault();
    const url = href.trim();
    if (!/^(https?:\/\/|mailto:)/i.test(url) || !isSafeLink(url)) {
      setError('Enter a complete http, https, or mailto link.');
      return;
    }
    if (editor.isDestroyed || !editor.isEditable) return onClose();
    const chain = editor.chain().setTextSelection({ from, to }).extendMarkRange('link');
    if (label.trim() && label !== editor.state.doc.textBetween(from, to, ' ')) {
      chain.insertContent({ type: 'text', text: label.trim(), marks: [{ type:'link', attrs:{ href:url } }] });
    } else if (from === to && !previous) {
      chain.insertContent({ type:'text', text:url, marks:[{ type:'link', attrs:{ href:url } }] });
    } else {
      chain.setLink({ href:url });
    }
    chain.run();
    onClose();
  };
  return <CaseStudyEditorDialog title={previous ? 'Edit link' : 'Insert link'} onClose={onClose}>
    <form className="rde-v8-form" onSubmit={save}>
      <label>Text<input value={label} onChange={event => setLabel(event.target.value)}/></label>
      <label>URL<input autoFocus value={href} onChange={event => setHref(event.target.value)} placeholder="https://"/></label>
      {error && <p role="alert" className="rde-notice">{error}</p>}
      <footer>
        {previous && <button type="button" onClick={() => {
          if (!editor.isDestroyed && editor.isEditable) editor.chain().setTextSelection({ from, to }).extendMarkRange('link').unsetLink().run();
          onClose();
        }}>Remove link</button>}
        <button type="button" onClick={onClose}>Cancel</button>
        <button className="rde-v8-primary">Save link</button>
      </footer>
    </form>
  </CaseStudyEditorDialog>;
}

function TableEditor({ onInsert, onClose }) {
  const [style, setStyle] = useState('clean');
  const [rows, setRows] = useState(3);
  const [columns, setColumns] = useState(3);
  return <CaseStudyEditorDialog title="Insert table" onClose={onClose}>
    <form className="rde-v8-form" onSubmit={event => {
      event.preventDefault();
      onInsert({ rows:Number(rows), cols:Number(columns), withHeaderRow:style !== 'clean' }, style);
    }}>
      <label>Table style<select value={style} onChange={event => setStyle(event.target.value)}>
        {CASE_STUDY_TABLE_STYLES.map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}
      </select></label>
      <label>Rows<input type="number" min="1" max="30" required value={rows} onChange={event => setRows(event.target.value)}/></label>
      <label>Columns<input type="number" min="1" max="12" required value={columns} onChange={event => setColumns(event.target.value)}/></label>
      <footer><button type="button" onClick={onClose}>Cancel</button><button className="rde-v8-primary">Insert table</button></footer>
    </form>
  </CaseStudyEditorDialog>;
}

const groups = ['Text', 'Paragraph', 'Insert', 'More'];

export default function CaseStudyV8Toolbar({ editor, meta, onInsertImage, advanced }) {
  const [group, setGroup] = useState('Text');
  const [dialog, setDialog] = useState(null);
  const [, redraw] = useState(0);
  useEffect(() => {
    setDialog(null);
    if (!editor) return undefined;
    const refresh = () => redraw(value => value + 1);
    editor.on('transaction', refresh);
    return () => editor.off('transaction', refresh);
  }, [editor]);
  const ready = Boolean(editor && !editor.isDestroyed && editor.isEditable);
  const run = command => () => { if (ready) command(editor.chain().focus()).run(); };
  const active = (name, attrs) => ready && editor.isActive(name, attrs);
  const tool = (Icon, label, action, pressed, unavailable = false) => <button type="button" aria-label={label} title={label}
    aria-pressed={pressed} disabled={!ready || unavailable} onMouseDown={event => event.preventDefault()} onClick={action}><Icon size={16}/></button>;
  const textTool = (label, action) => <button type="button" disabled={!ready} onMouseDown={event => event.preventDefault()} onClick={action}>{label}</button>;
  const close = () => {
    setDialog(null);
    if (editor && !editor.isDestroyed) editor.commands.focus();
  };
  const format = [1, 2, 3].find(level => active('heading', { level })) || (active('blockquote') ? 'quote' : 'paragraph');
  const fontFamily = editor?.getAttributes('textStyle').fontFamily || '';
  const fontValue = fontFamily === 'Inter' ? 'Inter Variable' : fontFamily;
  return <div className="rde-v8-toolbar" aria-label="Document formatting">
    <div className="rde-v8-toolbar-top">
      <div role="group" aria-label="Formatting groups">
        {groups.map(name => <button key={name} type="button" aria-pressed={group === name}
          onMouseDown={event => event.preventDefault()} onClick={() => setGroup(name)}>{name}</button>)}
      </div>

    </div>
    <div className="rde-v8-tools" role="toolbar" aria-label={group + ' tools'}>
      {group === 'Text' && <>
        <select aria-label="Paragraph style" value={format} disabled={!ready} onChange={event => {
          const value = event.target.value;
          run(chain => {
            if (value === 'quote') return chain.setBlockquote();
            const next = active('blockquote') ? chain.unsetBlockquote() : chain;
            return value === 'paragraph' ? next.setParagraph() : next.setHeading({ level:Number(value) });
          })();
        }}>
          <option value="paragraph">Paragraph</option><option value="1">Heading 1</option><option value="2">Heading 2</option><option value="3">Heading 3</option><option value="quote">Quote</option>
        </select>
        {tool(Bold, 'Bold', run(chain => chain.toggleBold()), active('bold'))}
        {tool(Italic, 'Italic', run(chain => chain.toggleItalic()), active('italic'))}
        {tool(Underline, 'Underline', run(chain => chain.toggleUnderline()), active('underline'))}
        {tool(Strikethrough, 'Strikethrough', run(chain => chain.toggleStrike()), active('strike'))}
        {advanced && <>
          <select disabled={!ready} aria-label="Font" value={fontValue} onChange={event => {
            const family = event.target.value;
            run(chain => family ? chain.setFontFamily(family) : chain.unsetFontFamily())();
          }}><option value="">Font</option><option value="Inter Variable">Inter</option><option value="Georgia">Georgia</option><option value="monospace">Monospace</option></select>
          <select disabled={!ready} aria-label="Font size" value={editor?.getAttributes('textStyle').fontSize || ''} onChange={event => {
            const size = event.target.value;
            run(chain => size ? chain.setFontSize(size) : chain.unsetFontSize())();
          }}><option value="">Font size</option>{[12, 14, 16, 18, 22, 28, 32].map(size => <option key={size} value={size+'px'}>{size}</option>)}</select>
          <input type="color" disabled={!ready} aria-label="Text color" onChange={event => run(chain => chain.setColor(event.target.value))()}/>
          <input type="color" disabled={!ready} aria-label="Highlight color" onChange={event => run(chain => chain.setHighlight({ color:event.target.value }))()}/>
        </>}
        {tool(RemoveFormatting, 'Clear formatting', run(chain => chain.unsetAllMarks()))}
      </>}
      {group === 'Paragraph' && <>
        {advanced && [[AlignLeft, 'left'], [AlignCenter, 'center'], [AlignRight, 'right'], [AlignJustify, 'justify']].map(([Icon, position]) =>
          <span key={position}>{tool(Icon, 'Align ' + position, run(chain => chain.setTextAlign(position)), active({ textAlign:position }))}</span>)}
        {tool(List, 'Bullet list', run(chain => chain.toggleBulletList()), active('bulletList'))}
        {tool(ListOrdered, 'Numbered list', run(chain => chain.toggleOrderedList()), active('orderedList'))}
        {advanced && tool(ListChecks, 'Checklist', run(chain => chain.toggleTaskList()), active('taskList'))}
        {tool(Minus, 'Divider', run(chain => chain.setHorizontalRule()))}
      </>}
      {group === 'Insert' && <>
        {tool(Link2, 'Insert or edit link', () => setDialog({ type:'link', selection:editor.state.selection }), active('link'))}
        {tool(ImagePlus, 'Insert image', onInsertImage)}
        {advanced && tool(Table2, 'Insert table', () => setDialog({ type:'table' }))}
        {advanced && [['shape','Shapes'],['chart','Chart'],['textBox','Text box'],['drawing','Freehand drawing']].map(([kind,label]) =>
          <span key={kind}>{textTool(label, () => setDialog({ type:'object', kind, selection:editor.state.selection }))}</span>)}
        {advanced && active('table') && <>
          <select aria-label="Current table style" value={editor.getAttributes('table').styleVariant || 'clean'} onChange={event=>run(chain=>chain.updateAttributes('table',{styleVariant:event.target.value}))()}>
            {CASE_STUDY_TABLE_STYLES.map(style=><option key={style} value={style}>{style}</option>)}
          </select>
          {textTool('Add row', run(chain => chain.addRowAfter()))}
          {textTool('Add column', run(chain => chain.addColumnAfter()))}
          {textTool('Delete row', run(chain => chain.deleteRow()))}
          {textTool('Delete column', run(chain => chain.deleteColumn()))}
          {textTool('Delete table', run(chain => chain.deleteTable()))}
        </>}
      </>}
      {group === 'More' && <>
        {tool(Undo2, 'Undo', run(chain => chain.undo()), undefined, !ready || !editor.can().undo())}
        {tool(Redo2, 'Redo', run(chain => chain.redo()), undefined, !ready || !editor.can().redo())}
      </>}
    </div>
      {meta && <small className="rde-v8-meta">{meta}</small>}
    {ready && dialog?.type === 'link' && <LinkEditor editor={editor} selection={dialog.selection} onClose={close}/>}
    {ready && dialog?.type === 'object' && <CaseStudyObjectComposer initial={{kind:dialog.kind}} Dialog={CaseStudyEditorDialog} onClose={close}
      onSave={attrs => { editor.chain().setTextSelection(dialog.selection).insertContent({type:'caseStudyObject',attrs}).run(); close(); }}/>}
    {ready && dialog?.type === 'table' && <TableEditor onClose={close} onInsert={(settings, style) => {
      run(chain => chain.insertTable(settings).updateAttributes('table', { styleVariant:style }))();
      close();
    }}/>}
  </div>;
}
