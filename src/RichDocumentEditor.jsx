import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import { TextSelection } from '@tiptap/pm/state';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlignCenter, AlignLeft, AlignRight, Bold, Heading1, Heading2, Heading3, ImagePlus, Italic, Link2, List, ListOrdered, Minus, Quote, Redo2, RemoveFormatting, Strikethrough, Underline as UnderlineIcon, Undo2, Unlink } from 'lucide-react';
import { isDocumentImageReference, readCaseStudyDocumentImage, saveCaseStudyDocumentImage } from './caseStudyDocumentImages.js';
import { emptyRichDocument, isSafeLink, normaliseRichDocument } from './studyRichDocument.js';
import { usePrompt } from './ConfirmationDialog.jsx';
import './richDocumentEditor.css';

const iconButton = (Icon, label, action, active = false, disabled = false) => <button type="button" className={active?'is-active':''} aria-label={label} title={label} onMouseDown={event=>event.preventDefault()} onClick={action} disabled={disabled}><Icon size={16}/></button>;
const percentage = value => Math.max(25,Math.min(100,Number(value)||100));

function ResearchImageView({node,selected,updateAttributes,editor,getPos,extension}) {
  const [resolved,setResolved]=useState(node.attrs.src);
  const [missing,setMissing]=useState(false);
  useEffect(()=>{
    let url=''; let active=true; setMissing(false); setResolved(node.attrs.src);
    if (!isDocumentImageReference(node.attrs.src)) return () => { active=false; };
    readCaseStudyDocumentImage(node.attrs.src).then(blob=>{
      if (!active) return;
      if (!blob) { setMissing(true); return; }
      url=URL.createObjectURL(blob); setResolved(url);
    }).catch(()=>active&&setMissing(true));
    return ()=>{ active=false; if(url) URL.revokeObjectURL(url); };
  },[node.attrs.src]);
  const select=()=>{ const position=typeof getPos==='function' ? getPos() : null; if(typeof position==='number') editor.commands.setNodeSelection(position); };
  const width=percentage(node.attrs.width);
  const evidenceActions=extension.options.evidenceActions?.current;
  const sharedEvidence=evidenceActions?.documentEvidence?.[node.attrs.src]||null;
  const keepNodeSelected=event=>event.preventDefault();
  return <NodeViewWrapper as="figure" className={`rde-image rde-image--${node.attrs.align||'center'}${selected?' is-selected':''}`} style={{width:`${width}%`}} data-drag-handle>
    {missing ? <button type="button" className="rde-missing-image" onClick={select}>Image unavailable on this device</button> : <img src={resolved} alt={node.attrs.alt||'Research note'} onClick={select} draggable="false" />}
    {selected && <div className="rde-image-controls" contentEditable={false} onClick={event=>event.stopPropagation()}>
      <label>Size <input aria-label="Image size" type="range" min="25" max="100" value={width} onChange={event=>updateAttributes({width:percentage(event.target.value)})}/></label>
      <div role="group" aria-label="Image alignment"><button type="button" aria-label="Align image left" className={node.attrs.align==='left'?'is-active':''} onMouseDown={keepNodeSelected} onClick={()=>updateAttributes({align:'left'})}><AlignLeft size={14}/></button><button type="button" aria-label="Center image" className={(node.attrs.align||'center')==='center'?'is-active':''} onMouseDown={keepNodeSelected} onClick={()=>updateAttributes({align:'center'})}><AlignCenter size={14}/></button><button type="button" aria-label="Align image right" className={node.attrs.align==='right'?'is-active':''} onMouseDown={keepNodeSelected} onClick={()=>updateAttributes({align:'right'})}><AlignRight size={14}/></button></div>
      {sharedEvidence ? <button type="button" className="rde-evidence-action" onMouseDown={keepNodeSelected} onClick={()=>evidenceActions?.onViewEvidence?.(sharedEvidence.id)}>View in Evidence Library</button> : <button type="button" className="rde-evidence-action" onMouseDown={keepNodeSelected} onClick={()=>evidenceActions?.onRequestEvidence?.({ref:node.attrs.src,preview:resolved})}>Save to Evidence Library</button>}
    </div>}
    <figcaption contentEditable={false}><input aria-label="Image caption" value={node.attrs.caption||''} onChange={event=>updateAttributes({caption:event.target.value})} placeholder="Add a caption…"/></figcaption>
  </NodeViewWrapper>;
}

const ResearchImage=Image.extend({
  addAttributes() { return { ...this.parent?.(), width:{default:100}, align:{default:'center'}, caption:{default:''} }; },
  addNodeView() { return ReactNodeViewRenderer(ResearchImageView); }
});

export async function insertImageInView(view,file,coordinates) {
  const src=await saveCaseStudyDocumentImage(file);
  let transaction=view.state.tr;
  const location=coordinates&&view.posAtCoords(coordinates);
  if(location) transaction=transaction.setSelection(TextSelection.create(view.state.doc,location.pos));
  transaction=transaction.replaceSelectionWith(view.state.schema.nodes.image.create({src,alt:file.name||'Research image',width:100,align:'center',caption:''})).scrollIntoView();
  view.dispatch(transaction);
}

function InlineEvidenceDialog({image,onClose,onSave,onSaved}) { const [title,setTitle]=useState(''),[source,setSource]=useState(''),[tags,setTags]=useState(''),[error,setError]=useState(''),[saving,setSaving]=useState(false); const submit=async event=>{event.preventDefault();if(!title.trim()){setError('Add a title before saving.');return;}setSaving(true);setError('');try{await onSave({imageRef:image.ref,title,source,tags:tags.split(',').map(tag=>tag.trim()).filter(Boolean)});onSaved?.();onClose();}catch(reason){setError(reason.message||'Evidence could not be saved.');setSaving(false);}};return <div className="case-dialog-backdrop"><form className="case-form-dialog rde-evidence-dialog" onSubmit={submit}><button type="button" className="case-close" onClick={onClose}>×</button><p className="case-eyebrow">Research Notes image</p><h2>Save to Evidence Library</h2>{image.preview&&<img className="rde-evidence-dialog__preview" src={image.preview} alt="Selected Research Notes image"/>}<label>Title<input autoFocus value={title} onChange={event=>setTitle(event.target.value)} placeholder="e.g. London sweep, 15m"/></label><label>Source <small>optional</small><input value={source} onChange={event=>setSource(event.target.value)} placeholder="e.g. TradingView"/></label><label>Tags <small>comma-separated</small><input value={tags} onChange={event=>setTags(event.target.value)} placeholder="EUR/USD, liquidity"/></label>{error&&<p className="case-form-error" role="alert">{error}</p>}<footer><button type="button" className="case-button case-button--quiet" onClick={onClose}>Cancel</button><button disabled={saving} className="case-button case-button--primary">{saving?'Saving…':'Save evidence'}</button></footer></form></div>; }

export default function RichDocumentEditor({ document, onChange, saveState, sectionName, documentEvidence={}, onSaveImage, onViewEvidence, bare=false, placeholder='', onFocusEditor=null }) {
  const prompt=usePrompt();
  const latestChange=useRef(onChange); latestChange.current=onChange;
  const latestFocus=useRef(onFocusEditor); latestFocus.current=onFocusEditor;
  const initial=useMemo(()=>normaliseRichDocument(document)||emptyRichDocument(),[]);
  const [notice,setNotice]=useState('');
  const [isDropping,setIsDropping]=useState(false);
  const [evidenceImage,setEvidenceImage]=useState(null);
  const fileInput=useRef(null);
  const evidenceActions=useRef();
  evidenceActions.current={documentEvidence,onRequestEvidence:setEvidenceImage,onViewEvidence};
  const editor=useEditor({
    extensions:[StarterKit.configure({link:false}),Underline,Link.configure({openOnClick:false,protocols:['http','https','mailto']}),ResearchImage.configure({evidenceActions}),Placeholder.configure({placeholder:placeholder||'Write the observation, the evidence behind it, and what you will test next…'}),CharacterCount],
    content:initial.content,
    editorProps:{
      attributes:{class:'rde-content',spellcheck:'true'},
      handlePaste:(view,event)=>{ const file=[...(event.clipboardData?.files||[])].find(item=>item.type.startsWith('image/')); if(!file)return false; event.preventDefault(); insertImageInView(view,file).catch(error=>setNotice(error.message)); return true; },
      handleDrop:(view,event,_slice,moved)=>{ const file=[...(event.dataTransfer?.files||[])].find(item=>item.type.startsWith('image/')); if(!file||moved)return false; event.preventDefault(); insertImageInView(view,file,{left:event.clientX,top:event.clientY}).catch(error=>setNotice(error.message)); return true; }
    },
    onUpdate:({editor:instance})=>latestChange.current({version:1,content:instance.getJSON()}),
    onFocus:({editor:instance})=>latestFocus.current?.(instance)
  });
  const insertImage=async event=>{ const file=event.target.files?.[0]; event.target.value=''; if(!file||!editor)return; try { await insertImageInView(editor.view,file); } catch(error) { setNotice(error.message); } };
  if(!editor)return <div className="rde-loading">Preparing document editor…</div>;
  const command=callback=>()=>callback(editor.chain().focus()).run();
  if(bare)return <div className={`rde rde-bare${isDropping?' is-dropping':''}`} onDragEnter={event=>{if([...event.dataTransfer.types].includes('Files'))setIsDropping(true);}} onDragLeave={event=>{if(event.currentTarget===event.target)setIsDropping(false);}} onDrop={()=>setIsDropping(false)}>
    <EditorContent editor={editor}/>{isDropping&&<div className="rde-drop-indicator">Drop PNG, JPEG, or WebP image into this section</div>}
    {notice&&<p className="rde-notice" role="alert">{notice}</p>}
    {evidenceImage&&<InlineEvidenceDialog image={evidenceImage} onClose={()=>setEvidenceImage(null)} onSave={onSaveImage} onSaved={()=>setNotice('Saved to Evidence Library. The inline image remains unchanged.')}/>}
  </div>;
  const setLink=async()=>{ const previous=editor.getAttributes('link').href||''; const href=await prompt({title:previous?'Edit link':'Add a link',description:'Paste a safe web or email link for the selected text.',label:'Link URL',placeholder:'https://',value:previous,confirmLabel:'Save link',hint:'Allowed: https://, http://, or mailto',required:false}); if(href===null)return; if(!href){editor.chain().focus().unsetLink().run();return;} if(!isSafeLink(href)){setNotice('Use an http, https, or mailto link.');return;} editor.chain().focus().extendMarkRange('link').setLink({href}).run(); };
  return <section className={`rde rde-document-workspace${isDropping?' is-dropping':''}`} onDragEnter={event=>{if([...event.dataTransfer.types].includes('Files'))setIsDropping(true);}} onDragLeave={event=>{if(event.currentTarget===event.target)setIsDropping(false);}} onDrop={()=>setIsDropping(false)}>
    <div className="rde-toolbar" role="toolbar" aria-label="Document formatting">
      <div>{iconButton(Undo2,'Undo',command(chain=>chain.undo()),false,!editor.can().undo())}{iconButton(Redo2,'Redo',command(chain=>chain.redo()),false,!editor.can().redo())}</div><i/>
      {iconButton(Bold,'Bold',command(chain=>chain.toggleBold()),editor.isActive('bold'))}{iconButton(Italic,'Italic',command(chain=>chain.toggleItalic()),editor.isActive('italic'))}{iconButton(UnderlineIcon,'Underline',command(chain=>chain.toggleUnderline()),editor.isActive('underline'))}{iconButton(Strikethrough,'Strikethrough',command(chain=>chain.toggleStrike()),editor.isActive('strike'))}{iconButton(RemoveFormatting,'Clear formatting',command(chain=>chain.unsetAllMarks()))}<i/>
      {iconButton(Heading1,'Heading 1',command(chain=>chain.toggleHeading({level:1})),editor.isActive('heading',{level:1}))}{iconButton(Heading2,'Heading 2',command(chain=>chain.toggleHeading({level:2})),editor.isActive('heading',{level:2}))}{iconButton(Heading3,'Heading 3',command(chain=>chain.toggleHeading({level:3})),editor.isActive('heading',{level:3}))}{iconButton(List,'Bullet list',command(chain=>chain.toggleBulletList()),editor.isActive('bulletList'))}{iconButton(ListOrdered,'Numbered list',command(chain=>chain.toggleOrderedList()),editor.isActive('orderedList'))}{iconButton(Quote,'Quote',command(chain=>chain.toggleBlockquote()),editor.isActive('blockquote'))}{iconButton(Minus,'Divider',command(chain=>chain.setHorizontalRule()))}<i/>
      {iconButton(Link2,'Add or edit link',setLink,editor.isActive('link'))}{iconButton(Unlink,'Remove link',command(chain=>chain.unsetLink()),false,!editor.isActive('link'))}{iconButton(ImagePlus,'Insert image',()=>fileInput.current?.click())}<input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={insertImage} hidden/>
      <span className="rde-status">{saveState}</span>
    </div>
    <div className="rde-document-canvas">
      <div className="rde-document-head"><div><p className="case-eyebrow">Research notes</p><h3>{sectionName}</h3></div><span>{editor.storage.characterCount.words()} words</span></div>
      <div className="rde-page"><EditorContent editor={editor}/>{isDropping&&<div className="rde-drop-indicator">Drop PNG, JPEG, or WebP image into this section</div>}</div>
      <footer className="rde-footer"><span>Images are stored locally in this browser. Select one to save a reusable copy to Evidence Library.</span>{notice&&<span className="rde-notice" role="alert">{notice}</span>}</footer>
    </div>
    {evidenceImage&&<InlineEvidenceDialog image={evidenceImage} onClose={()=>setEvidenceImage(null)} onSave={onSaveImage} onSaved={()=>setNotice('Saved to Evidence Library. The inline image remains unchanged.')}/>} 
  </section>;
}
