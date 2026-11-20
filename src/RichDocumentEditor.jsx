import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor } from '@tiptap/react';
import { CaseStudyObject } from './caseStudyV8Objects.js';
import { CaseStudyObjectView, CaseStudyObjectComposer } from './CaseStudyV8Objects.jsx';
import { Extension } from '@tiptap/core';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import { EditorState, Plugin, TextSelection } from '@tiptap/pm/state';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AlignCenter, AlignLeft, AlignRight, FlipHorizontal, FlipVertical, RotateCcw, RotateCw, Trash2 } from 'lucide-react';
import { isDocumentImageReference, readCaseStudyDocumentImage, saveCaseStudyDocumentImage } from './caseStudyDocumentImages.js';
import { useEvidenceImageUrl } from './caseStudyEvidenceImages.js';
import { isCaseStudySharedImageReference } from './caseStudySharedImageIntegration.js';
import { emptyRichDocument, isSafeLink, richDocumentText } from './studyRichDocument.js';
import { caseStudyDocumentExtensions, RichCaseStudyImage, usesV8CaseStudyContent, validateCaseStudyDocument } from './caseStudyRichFormat.js';
import CaseStudyV8Toolbar, { CaseStudyEditorDialog } from './CaseStudyV8Toolbar.jsx';
import './richDocumentEditor.css';

const percentage = value => Math.max(25, Math.min(100, Number(value) || 100));

function ResearchImageView({node,selected,updateAttributes,editor,getPos,extension}) {
  const [resolved,setResolved]=useState(node.attrs.src);
  const [missing,setMissing]=useState(false);
  const isShared=isCaseStudySharedImageReference(node.attrs.src);
  const sharedImage=useEvidenceImageUrl(isShared ? node.attrs.src : '', {userId:extension.options.imageOwnerUserId||'',localOnly:node.attrs.localOnly===true,cloudRef:node.attrs.cloudRef||''});
  useEffect(()=>{
    let url=''; let active=true; setMissing(false); setResolved(node.attrs.src);
    if (isShared) return () => { active=false; };
    if (!isDocumentImageReference(node.attrs.src)) return () => { active=false; };
    readCaseStudyDocumentImage(node.attrs.src).then(blob=>{
      if (!active) return;
      if (!blob) { setMissing(true); return; }
      url=URL.createObjectURL(blob); setResolved(url);
    }).catch(()=>active&&setMissing(true));
    return ()=>{ active=false; if(url) URL.revokeObjectURL(url); };
  },[node.attrs.src,isShared]);
  const select=()=>{ const position=typeof getPos==='function' ? getPos() : null; if(typeof position==='number') editor.commands.setNodeSelection(position); };
  const width=percentage(node.attrs.width);
  const evidenceActions=extension.options.evidenceActions?.current;
  const sharedEvidence=evidenceActions?.documentEvidence?.[node.attrs.src]||null;
  const keepNodeSelected=event=>event.preventDefault();
  const advanced = extension.options.policy?.current.advanced;
  const rotate = delta => updateAttributes({ rotation: ((Number(node.attrs.rotation) || 0) + delta + 360) % 360 });
  const imageUrl = isShared ? sharedImage.url : resolved;
  const transform = `rotate(${Number(node.attrs.rotation) || 0}deg) scale(${node.attrs.flipX ? -1 : 1}, ${node.attrs.flipY ? -1 : 1})`;
  const unavailable = isShared ? sharedImage.missing : missing;
  return <NodeViewWrapper as="figure" className={`rde-image rde-image--${node.attrs.align||'center'}${node.attrs.wrap?' is-wrapped':''}${selected?' is-selected':''}`} style={{width:`${width}%`}} data-drag-handle>
    {unavailable ? <button type="button" className="rde-missing-image" onClick={select}>Image unavailable on this device</button> :
      <div className="rde-image-media"><img src={imageUrl || undefined} alt={node.attrs.alt || 'Research note'} onClick={select}
        style={{ transform }} draggable="false"/></div>}
    {selected && editor.isEditable && <div className="rde-image-controls" contentEditable={false} onClick={event=>event.stopPropagation()}>
      <label>Size <input aria-label="Image size" type="range" min="25" max="100" value={width} onChange={event=>updateAttributes({width:percentage(event.target.value)})}/></label>
      <div role="group" aria-label="Image alignment"><button type="button" aria-label="Align image left" className={node.attrs.align==='left'?'is-active':''} onMouseDown={keepNodeSelected} onClick={()=>updateAttributes({align:'left'})}><AlignLeft size={14}/></button><button type="button" aria-label="Center image" className={(node.attrs.align||'center')==='center'?'is-active':''} onMouseDown={keepNodeSelected} onClick={()=>updateAttributes({align:'center'})}><AlignCenter size={14}/></button><button type="button" aria-label="Align image right" className={node.attrs.align==='right'?'is-active':''} onMouseDown={keepNodeSelected} onClick={()=>updateAttributes({align:'right'})}><AlignRight size={14}/></button></div>
      {advanced && <div role="group" aria-label="Image transforms">
        <button type="button" aria-label="Rotate image left" onMouseDown={keepNodeSelected} onClick={() => rotate(-90)}><RotateCcw size={14}/></button>
        <button type="button" aria-label="Rotate image right" onMouseDown={keepNodeSelected} onClick={() => rotate(90)}><RotateCw size={14}/></button>
        <button type="button" aria-label="Flip image horizontally" aria-pressed={node.attrs.flipX} onMouseDown={keepNodeSelected} onClick={() => updateAttributes({ flipX: !node.attrs.flipX })}><FlipHorizontal size={14}/></button>
        <button type="button" aria-label="Flip image vertically" aria-pressed={node.attrs.flipY} onMouseDown={keepNodeSelected} onClick={() => updateAttributes({ flipY: !node.attrs.flipY })}><FlipVertical size={14}/></button>
        <button type="button" className="rde-evidence-action" aria-pressed={node.attrs.wrap} onMouseDown={keepNodeSelected} onClick={() => updateAttributes({ wrap: !node.attrs.wrap, align: node.attrs.align === 'center' ? 'left' : node.attrs.align })}>Wrap text</button>
      </div>}
      {sharedEvidence && evidenceActions?.onViewEvidence &&
        <button type="button" className="rde-evidence-action" onMouseDown={keepNodeSelected} onClick={()=>evidenceActions.onViewEvidence(sharedEvidence.id)}>View in Evidence Library</button>}
      {!sharedEvidence && !unavailable && evidenceActions?.onRequestEvidence && <button type="button" className="rde-evidence-action"
        onMouseDown={keepNodeSelected} onClick={()=>evidenceActions.onRequestEvidence({ref:node.attrs.src,preview:imageUrl,title:node.attrs.alt})}>Save to Evidence Library</button>}
      <button type="button" aria-label="Remove inline image" onMouseDown={keepNodeSelected} onClick={() => { select(); editor.commands.deleteSelection(); }}><Trash2 size={14}/></button>
    </div>}
    <figcaption contentEditable={false}><input aria-label="Image caption" readOnly={!editor.isEditable} value={node.attrs.caption||''} onChange={event=>updateAttributes({caption:event.target.value})} placeholder="Add a caption…"/></figcaption>
  </NodeViewWrapper>;
}

const ResearchImage = RichCaseStudyImage.extend({
  addOptions() {
    return { ...this.parent?.(), evidenceActions: null, imageOwnerUserId: '', policy: null };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResearchImageView);
  },
});

export async function insertImageInView(view,file,coordinates,{saveImage}={}) {
  if (view.isDestroyed || !view.editable) return;
  const stored=saveImage ? await saveImage(file) : await saveCaseStudyDocumentImage(file);
  if (view.isDestroyed || !view.editable) return;
  const src=typeof stored==='string'?stored:stored.src;
  let transaction=view.state.tr;
  const location=coordinates&&view.posAtCoords(coordinates);
  if(location) transaction=transaction.setSelection(TextSelection.near(view.state.doc.resolve(location.pos)));
  transaction=transaction.replaceSelectionWith(view.state.schema.nodes.image.create({src,localOnly:typeof stored==='object'&&stored.localOnly===true,alt:file.name||'Research image',width:100,align:'center',caption:''})).scrollIntoView();
  view.dispatch(transaction);
}

function InlineEvidenceDialog({ image, onClose, onSave, onSaved }) {
  const [title, setTitle] = useState(image.title || '');
  const [source, setSource] = useState('');
  const [tags, setTags] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const close = () => { if (!busy.current) onClose(); };
  const submit = async event => {
    event.preventDefault();
    if (busy.current) return;
    if (!title.trim()) return setError('Add a title before saving.');
    busy.current = true;
    setSaving(true);
    setError('');
    try {
      await onSave({ imageRef:image.ref, title:title.trim(), source:source.trim(), tags:tags.split(',').map(tag=>tag.trim()).filter(Boolean) });
      onSaved();
      onClose();
    } catch (reason) {
      setError(reason.message || 'Evidence could not be saved.');
      busy.current = false;
      setSaving(false);
    }
  };
  return <CaseStudyEditorDialog title="Save to Evidence Library" onClose={close}>
    <form className="rde-v8-form" onSubmit={submit}>
      <p>The image stays in this section. Saving also makes it available in your Evidence Library.</p>
      {image.preview && <img className="rde-evidence-dialog__preview" src={image.preview} alt="Selected Research Notes image"/>}
      <label>Title<input autoFocus required value={title} disabled={saving} onChange={event => setTitle(event.target.value)}/></label>
      <label>Source<input value={source} disabled={saving} onChange={event => setSource(event.target.value)} placeholder="Optional"/></label>
      <label>Tags<input value={tags} disabled={saving} onChange={event => setTags(event.target.value)} placeholder="Optional, comma-separated"/></label>
      {error && <p className="rde-notice" role="alert">{error}</p>}
      <footer><button type="button" disabled={saving} onClick={close}>Cancel</button>
        <button className="rde-v8-primary" disabled={saving}>{saving?'Saving…':'Save evidence'}</button></footer>
    </form>
  </CaseStudyEditorDialog>;
}

function formatGuard(policy) {
  return Extension.create({
    name: 'caseStudyFormatGuard',
    addProseMirrorPlugins() {
      return [new Plugin({
        filterTransaction(transaction) {
          if (!transaction.docChanged || policy.current.loading) return true;
          if (!policy.current.writable) return false;
          if (policy.current.advanced || !usesV8CaseStudyContent(transaction.doc.toJSON())) return true;
          policy.current.onBlocked();
          return false;
        },
      })];
    },
  });
}

export default function RichDocumentEditor(props) {
  const { document, readOnly = false, advanced = false } = props;
  const incoming = document ?? emptyRichDocument();
  const valid = useMemo(() => validateCaseStudyDocument(incoming), [document]);
  if (!valid) {
    // Tiptap may fall back to a blank document for unknown nodes. Never
    // instantiate a writable editor with an unrecognized document.
    return <div className="rde-protected">
      <p role="status">This section needs a newer Case Study editor. Its saved content is protected.</p>
      {richDocumentText(incoming) && <p className="rde-protected-text">{richDocumentText(incoming)}</p>}
    </div>;
  }
  return <RichDocumentSurface {...props} document={incoming}
    readOnly={readOnly || (!advanced && usesV8CaseStudyContent(incoming.content))}/>;
}

function RichDocumentSurface({
  document, onChange, saveState, sectionName, documentEvidence = {},
  onSaveImage, onStoreImage, imageOwnerUserId = '', onViewEvidence,
  bare = false, placeholder = '', onFocusEditor, advanced = false, readOnly = false,
}) {
  const [notice, setNotice] = useState('');
  const [isDropping, setIsDropping] = useState(false);
  const [evidenceImage, setEvidenceImage] = useState(null);
  const [destination, setDestination] = useState('');
  const [object, setObject] = useState(null);
  const [tableMenu, setTableMenu] = useState(null);
  const fileInput = useRef(null);
  const latest = useRef({});
  latest.current = { onChange, onFocusEditor, onStoreImage };
  const policy = useRef({ loading:false });
  Object.assign(policy.current, {
    writable:!readOnly, advanced,
    onBlocked:() => queueMicrotask(() => setNotice('This formatting is available in the local V8 preview only.')),
  });
  const evidenceActions = useRef({});
  evidenceActions.current = { documentEvidence, onRequestEvidence:onSaveImage ? setEvidenceImage : null, onViewEvidence };
  const editor = useEditor({
    extensions: [
      ...caseStudyDocumentExtensions.filter(extension => extension.name !== 'caseStudyObject'),
      CaseStudyObject.extend({ addNodeView() { return ReactNodeViewRenderer(CaseStudyObjectView); } }),
      ResearchImage.configure({ evidenceActions, imageOwnerUserId, policy }),
      Placeholder.configure({ placeholder:placeholder || 'Write your research notes…' }),
      CharacterCount,
      formatGuard(policy),
    ],
    caseStudyObjectEdit:attrs => setObject(attrs),
    content:document.content,
    editable:!readOnly,
    enableContentCheck:true,
    editorProps: {
      attributes:{ class:'rde-content', spellcheck:'true', 'aria-label':sectionName || 'Research notes' },
      handleClick(_view, _position, event) {
        const anchor = event.target.closest?.('a[href]');
        if (!anchor) return false;
        event.preventDefault();
        const href = anchor.getAttribute('href');
        if (/^(https?:\/\/|mailto:)/i.test(href) && isSafeLink(href)) setDestination(href);
        return true;
      },
      handleDOMEvents: {
        contextmenu(view, event) {
          const cell=event.target.closest?.('td,th');
          if (!cell || !view.dom.contains(cell) || !policy.current.writable) return false;
          event.preventDefault();
          const position=view.posAtDOM(cell,0);
          view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(position))));
          setTableMenu({left:Math.max(8,Math.min(event.clientX,window.innerWidth-210)),top:Math.max(8,Math.min(event.clientY,window.innerHeight-280))});
          return true;
        },
      },
      handlePaste(view, event) {
        const file = [...(event.clipboardData?.files || [])].find(item => item.type.startsWith('image/'));
        if (!file) return false;
        event.preventDefault();
        insertImageInView(view, file, undefined, { saveImage:latest.current.onStoreImage }).catch(error => setNotice(error.message));
        return true;
      },
      handleDrop(view, event, _slice, moved) {
        const file = [...(event.dataTransfer?.files || [])].find(item => item.type.startsWith('image/'));
        if (!file || moved) return false;
        event.preventDefault();
        insertImageInView(view, file, { left:event.clientX, top:event.clientY }, { saveImage:latest.current.onStoreImage }).catch(error => setNotice(error.message));
        return true;
      },
    },
    onUpdate:({ editor:instance }) => {
      if (policy.current.writable && !policy.current.loading) latest.current.onChange?.({ version:1, content:instance.getJSON() });
    },
    onFocus:({ editor:instance }) => latest.current.onFocusEditor?.(instance),
  }, [imageOwnerUserId, sectionName]);

  // A changed remote snapshot may arrive while the editor stays mounted.
  // Replace it without emitting an edit or retaining undo from the old snapshot.
  const encoded = JSON.stringify(document.content);
  useLayoutEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const remote = editor.schema.nodeFromJSON(JSON.parse(encoded));
    if (editor.state.doc.eq(remote)) return;
    policy.current.loading = true;
    try {
      editor.view.updateState(EditorState.create({
        schema:editor.schema, doc:remote, plugins:editor.state.plugins,
      }));
    } finally {
      policy.current.loading = false;
    }
  }, [editor, encoded]);
  useLayoutEffect(() => {
    editor?.setEditable(!readOnly, false);
  }, [editor, readOnly]);

  useEffect(() => {
    if(!tableMenu)return undefined;
    const close=event=>{
      if(event.type==='keydown'&&event.key!=='Escape')return;
      if(event.type==='pointerdown'&&event.target.closest?.('.rde-v8-table-menu'))return;
      setTableMenu(null);
    };
    window.document.addEventListener('pointerdown',close);
    window.document.addEventListener('keydown',close);
    return()=>{
      window.document.removeEventListener('pointerdown',close);
      window.document.removeEventListener('keydown',close);
    };
  },[tableMenu]);

  if (!editor) return <div className="rde-loading">Preparing document editor…</div>;
  const insertImage = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try { await insertImageInView(editor.view, file, undefined, { saveImage:onStoreImage }); }
    catch (error) { setNotice(error.message); }
  };
  const messages = <>
    {readOnly && <p className="rde-protected" role="status">This section is read-only. Its saved content is preserved.</p>}
    {notice && <p className="rde-notice" role="status">{notice}</p>}
  </>;
  const dialogs = <>
    {tableMenu && !readOnly && <div className="rde-v8-table-menu" role="group" aria-label="Table cell actions"
      style={tableMenu}>
      {[
        ['Insert row above','addRowBefore'],['Insert row below','addRowAfter'],
        ['Insert column left','addColumnBefore'],['Insert column right','addColumnAfter'],
        ['Delete row','deleteRow'],['Delete column','deleteColumn'],['Delete table','deleteTable'],
      ].map(([label,command])=><button key={command} type="button" onMouseDown={event=>event.preventDefault()}
        onClick={()=>{if(editor.isEditable)editor.chain().focus()[command]().run();setTableMenu(null);}}>{label}</button>)}
    </div>}
    {object && advanced && !readOnly && <CaseStudyObjectComposer initial={object} Dialog={CaseStudyEditorDialog} onClose={() => setObject(null)} onSave={attrs => {
      if (!editor.isDestroyed && editor.isEditable && editor.state.doc.nodeAt(object.position)?.type.name === 'caseStudyObject') {
        editor.chain().setNodeSelection(object.position).updateAttributes('caseStudyObject', attrs).run();
      }
      setObject(null);
    }}/>}
    {evidenceImage && onSaveImage && <InlineEvidenceDialog image={evidenceImage} onClose={()=>setEvidenceImage(null)}
      onSave={onSaveImage} onSaved={()=>setNotice('Saved to Evidence Library. The inline image remains unchanged.')}/>}
    {destination && <CaseStudyEditorDialog title="Open external link?" onClose={()=>setDestination('')}>
      <p className="rde-v8-destination">{destination}</p>
      <footer><button type="button" autoFocus onClick={()=>setDestination('')}>Cancel</button>
        <a className="rde-v8-primary" href={destination} target="_blank" rel="noopener noreferrer" onClick={()=>setDestination('')}>Open Link</a></footer>
    </CaseStudyEditorDialog>}
  </>;
  const drag = {
    onDragEnter:event => { if (!readOnly && [...event.dataTransfer.types].includes('Files')) setIsDropping(true); },
    onDragLeave:event => { if (!event.currentTarget.contains(event.relatedTarget)) setIsDropping(false); },
    onDrop:() => setIsDropping(false),
  };
  const content = <><EditorContent editor={editor}/>{isDropping && <div className="rde-drop-indicator">Drop PNG, JPEG, or WebP image into this section</div>}</>;
  if (bare) return <div className="rde rde-bare" {...drag}>{content}{messages}{dialogs}</div>;
  return <section className="rde rde-document-workspace" {...drag}>
    <CaseStudyV8Toolbar editor={editor} meta={saveState} advanced={advanced} onInsertImage={()=>fileInput.current?.click()}/>
    <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={insertImage} hidden/>
    <div className="rde-document-canvas">
      <div className="rde-document-head"><div><p className="case-eyebrow">Research notes</p><h3>{sectionName}</h3></div></div>
      <div className="rde-page">{content}</div>
      {messages}
    </div>
    {dialogs}
  </section>;
}
